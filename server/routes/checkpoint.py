"""
Checkpoint routes — Register transit node check-ins with document hash verification.

At every node:
1. Recompute SHA-256 from the shipment's current document texts
2. Compare with the hash anchored on blockchain (from creation or last checkpoint)
3. If mismatch → flag `document_tampered` anomaly (someone modified the docs)
4. Anchor the current hash on blockchain for the next node to verify
5. Advance shipment through the route
"""

import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from models.telemetry_model import CheckpointInput
from services import firebase_service, blockchain_service, genai_service
from services.risk_engine import evaluate_checkpoint
from services.eta_engine import propagate_delay
from services.auth_middleware import get_current_user, UserContext

router = APIRouter(prefix="/checkpoints", tags=["Checkpoints"])


def compute_doc_hash(po_text: str, invoice_text: str, bol_text: str) -> bytes:
    """Same deterministic hash as used at shipment creation."""
    combined = f"PO:{po_text}|INV:{invoice_text}|BOL:{bol_text}"
    return hashlib.sha256(combined.encode("utf-8")).digest()


@router.post("/", response_model=dict)
async def register_checkpoint(
    checkpoint: CheckpointInput,
    user: UserContext = Depends(get_current_user),
):
    """
    Register a checkpoint at a transit node.
    Verifies document integrity via blockchain hash comparison.
    """
    # ─── Fetch shipment ─────────────────────────────────
    shipment = await firebase_service.get_shipment(checkpoint.shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.get("current_status") == "delivered":
        raise HTTPException(status_code=400, detail="Shipment already delivered")

    route = shipment.get("route", [])
    risk_profile = shipment.get("risk_profile", {})
    product_category = risk_profile.get("product_category", "default")

    # ─── Find node in route ─────────────────────────────
    node_index = -1
    for i, node in enumerate(route):
        if node.get("location_code") == checkpoint.location_code:
            node_index = i
            break

    if node_index == -1:
        raise HTTPException(
            status_code=400,
            detail=f"Location {checkpoint.location_code} is not on this shipment's route",
        )

    # Enforce in-order traversal
    for i in range(node_index):
        if not route[i].get("actual_arrival"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot check in at {checkpoint.location_code} — "
                       f"previous node {route[i]['location_code']} not visited yet",
            )

    if route[node_index].get("actual_arrival"):
        raise HTTPException(
            status_code=400,
            detail=f"Checkpoint at {checkpoint.location_code} already recorded",
        )

    # ─── Document hash verification ─────────────────────
    # Recompute hash from current document texts
    current_hash = compute_doc_hash(
        shipment.get("po_text", ""),
        shipment.get("invoice_text", ""),
        shipment.get("bol_text", ""),
    )
    current_hash_hex = current_hash.hex()

    # Compare with on-chain hash
    hash_verification = await blockchain_service.verify_checkpoint_hash(
        shipment_id=checkpoint.shipment_id,
        expected_hash=current_hash,
    )

    tamper_detected = False
    if not hash_verification.get("verified", True):
        tamper_detected = True
        anomaly_data = {
            "shipment_id": checkpoint.shipment_id,
            "anomaly_type": "document_tampered",
            "severity": "critical",
            "details": {
                "expected_hash": hash_verification.get("on_chain_hash"),
                "current_hash": current_hash_hex,
                "location": checkpoint.location_code,
                "message": "Document texts have been modified since the last checkpoint. "
                           "The SHA-256 hash does not match the on-chain record. "
                           "Possible tampering or unauthorized modification detected.",
            },
            "location_code": checkpoint.location_code,
            "resolved": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await firebase_service.add_anomaly(anomaly_data)

    # ─── Calculate delay ────────────────────────────────
    now = checkpoint.timestamp or datetime.now(timezone.utc)
    delay_seconds = 0.0

    if route[node_index].get("expected_arrival"):
        try:
            expected = datetime.fromisoformat(route[node_index]["expected_arrival"])
            delta = (now - expected).total_seconds()
            if delta > 0:
                delay_seconds = delta
        except (ValueError, TypeError):
            pass

    # ─── Deterministic anomaly rules ────────────────────
    expected_weight = None
    telemetry_records = await firebase_service.get_telemetry(checkpoint.shipment_id)
    if telemetry_records:
        expected_weight = telemetry_records[0].get("weight_kg")

    anomalies = evaluate_checkpoint(
        shipment_id=checkpoint.shipment_id,
        product_category=product_category,
        location_code=checkpoint.location_code,
        temperature=checkpoint.temperature,
        humidity=checkpoint.humidity,
        weight_kg=checkpoint.weight_kg,
        expected_weight_kg=expected_weight,
        delay_hours=delay_seconds / 3600,
    )

    # ─── Store telemetry ────────────────────────────────
    telemetry_data = {
        "location_code": checkpoint.location_code,
        "temperature": checkpoint.temperature,
        "humidity": checkpoint.humidity,
        "weight_kg": checkpoint.weight_kg,
        "timestamp": now.isoformat(),
        "scanned_by": user.user_id,
    }
    await firebase_service.add_telemetry(checkpoint.shipment_id, telemetry_data)

    # ─── Anchor current hash on blockchain ──────────────
    # This anchors the CURRENT document hash so the next node can verify it
    tx_result = await blockchain_service.append_checkpoint(
        shipment_id=checkpoint.shipment_id,
        location_code=checkpoint.location_code,
        weight_kg=int(checkpoint.weight_kg),
        document_hash=current_hash,
    )

    # ─── Advance shipment ───────────────────────────────
    route[node_index]["actual_arrival"] = now.isoformat()

    tx_hashes = shipment.get("blockchain_tx_hashes", [])
    if tx_result.get("tx_hash"):
        tx_hashes.append(tx_result["tx_hash"])

    is_final = node_index == len(route) - 1
    new_status = "delivered" if is_final else "in_transit"

    if delay_seconds > 0 and not is_final:
        updated_route = propagate_delay(route, node_index, delay_seconds / 3600)
    else:
        updated_route = route

    await firebase_service.update_shipment(
        checkpoint.shipment_id,
        {
            "route": updated_route,
            "current_status": new_status,
            "blockchain_tx_hashes": tx_hashes,
        },
    )

    # ─── Process telemetry anomalies (skip GenAI to avoid blocking) ──
    anomaly_list = []
    for anomaly in anomalies:
        anomaly_dict = anomaly.model_dump(mode="json")
        await firebase_service.add_anomaly(anomaly_dict)
        anomaly_list.append(anomaly_dict)

    return {
        "status": "delivered" if is_final
                  else "tamper_detected" if tamper_detected
                  else "anomaly_detected" if anomalies
                  else "transferred",
        "node_index": node_index,
        "location": checkpoint.location_code,
        "is_final_destination": is_final,
        "shipment_status": new_status,
        "checkpoint": telemetry_data,
        "blockchain_tx": tx_result,
        "hash_verification": {
            "current_hash": current_hash_hex,
            "on_chain_hash": hash_verification.get("on_chain_hash"),
            "verified": hash_verification.get("verified"),
            "status": hash_verification.get("status"),
            "tamper_detected": tamper_detected,
        },
        "anomalies": anomaly_list,
        "delay_seconds": delay_seconds,
    }
