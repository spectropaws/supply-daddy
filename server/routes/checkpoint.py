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
from routes.shipment import compute_doc_hash

router = APIRouter(prefix="/checkpoints", tags=["Checkpoints"])


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
    risk_profile = shipment.get("risk_profile") or {}
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
    current_po = shipment.get("po_text", "")
    current_inv = shipment.get("invoice_text", "")
    current_bol = shipment.get("bol_text", "")

    # Recompute hash from current text strings (same formula as shipment creation)
    current_hash = compute_doc_hash(current_po, current_inv, current_bol)
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

    # ─── Process telemetry anomalies + GenAI Mitigations ──
    import asyncio
    
    anomaly_list = []
    
    # Collect all anomaly dicts to process through GenAI
    all_anomaly_dicts = []
    
    # Add deterministic anomalies from risk engine
    for a in anomalies:
        all_anomaly_dicts.append(a.model_dump(mode="json"))
    
    # Add tamper anomaly if detected (it hasn't been saved to Firebase yet)
    if tamper_detected:
        all_anomaly_dicts.append(anomaly_data)
    
    # Process each anomaly through GenAI concurrently
    async def process_anomaly(anomaly_dict):
        try:
            context = {
                **anomaly_dict,
                "product_category": product_category,
                "route_progress": f"Node {node_index + 1} of {len(route)}",
                "current_status": "tampered" if tamper_detected else "delayed" if delay_seconds > 0 else "in_transit"
            }
            
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[Checkpoint] Processing anomaly {anomaly_dict.get('anomaly_type')} through GenAI...")
            
            assessment = await asyncio.wait_for(
                genai_service.interpret_anomaly(context),
                timeout=30.0
            )
            anomaly_dict["genai_assessment"] = assessment
            logger.info(f"[Checkpoint] GenAI assessment received for {anomaly_dict.get('anomaly_type')}: severity={assessment.get('severity_level')}")
        except asyncio.TimeoutError:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"[Checkpoint] GenAI timed out after 30s for {anomaly_dict.get('anomaly_type')}")
            anomaly_dict["genai_assessment"] = {
                "risk_assessment": "System detected an anomaly but AI service timed out.",
                "business_impact": "Unknown",
                "recommended_action": "Manual review required by operations team.",
                "severity_level": anomaly_dict.get("severity", "MEDIUM").upper(),
                "error": "timeout"
            }
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"[Checkpoint] GenAI error for {anomaly_dict.get('anomaly_type')}: {e}", exc_info=True)
            anomaly_dict["genai_assessment"] = {
                "risk_assessment": "System detected an anomaly but AI service timed out.",
                "business_impact": "Unknown",
                "recommended_action": "Manual review required by operations team.",
                "severity_level": anomaly_dict.get("severity", "MEDIUM").upper(),
                "error": str(e)
            }
            
        await firebase_service.add_anomaly(anomaly_dict)
        return anomaly_dict

    # Run AI classifications for all anomalies
    if all_anomaly_dicts:
        tasks = [process_anomaly(d) for d in all_anomaly_dicts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, dict):
                anomaly_list.append(r)
    
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
