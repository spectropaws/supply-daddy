"""
Shipment routes — Create, list, retrieve, and tamper (demo) shipments.
Now stores document texts and anchors their hash on blockchain.
"""

import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from models.shipment_model import ShipmentCreate
from services import firebase_service, genai_service, blockchain_service
from services.pii_masking import PIIMasker
from services.auth_middleware import get_current_user, require_role, UserContext
from services.route_graph import find_optimal_route

router = APIRouter(prefix="/shipments", tags=["Shipments"])


def compute_doc_hash(po_text: str, invoice_text: str, bol_text: str) -> bytes:
    """Deterministic SHA-256 hash of all document texts."""
    combined = f"PO:{po_text}|INV:{invoice_text}|BOL:{bol_text}"
    return hashlib.sha256(combined.encode("utf-8")).digest()


@router.post("/", response_model=dict)
async def create_shipment(
    shipment: ShipmentCreate,
    user: UserContext = Depends(require_role("manufacturer")),
):
    """
    Create a new shipment (manufacturer only).
    Stores document texts and anchors their hash on blockchain.
    """
    existing = await firebase_service.get_shipment(shipment.shipment_id)
    if existing:
        raise HTTPException(status_code=409, detail="Shipment already exists")

    # Auto-generate route if not provided
    if not shipment.route:
        route = find_optimal_route(shipment.origin, shipment.destination)
        if not route:
            raise HTTPException(
                status_code=400,
                detail=f"No route found between {shipment.origin} and {shipment.destination}",
            )
        route_dicts = route
    else:
        route_dicts = [node.model_dump(mode="json") for node in shipment.route]

    risk_profile = None

    # Document texts (stored for hash verification)
    po_text = shipment.po_text or ""
    invoice_text = shipment.invoice_text or ""
    bol_text = shipment.bol_text or ""

    # If documents provided, run GenAI classification (with timeout)
    if po_text or invoice_text or bol_text:
        import asyncio
        masker = PIIMasker()
        masked_po = masker.mask_text(po_text)
        masked_inv = masker.mask_text(invoice_text)
        masked_bol = masker.mask_text(bol_text)

        try:
            classification = await asyncio.wait_for(
                genai_service.classify_shipment(masked_po, masked_inv, masked_bol),
                timeout=5.0,
            )
            classification = masker.unmask_dict(classification)

            risk_profile = {
                "product_category": classification.get("product_category", "default"),
                "risk_flags": classification.get("risk_flags", []),
                "hazard_class": classification.get("hazard_class"),
                "compliance_required": classification.get("compliance_required", []),
                "confidence_score": classification.get("confidence_score", 0.0),
            }
        except Exception:
            risk_profile = None

    # Compute document hash
    doc_hash = compute_doc_hash(po_text, invoice_text, bol_text)

    # Build shipment data — include raw document texts for later hash recomputation
    shipment_data = {
        "shipment_id": shipment.shipment_id,
        "origin": shipment.origin,
        "destination": shipment.destination,
        "manufacturer_id": user.user_id,
        "receiver_id": shipment.receiver_id,
        "route": route_dicts,
        "risk_profile": risk_profile,
        "current_status": "created",
        "blockchain_tx_hashes": [],
        "po_text": po_text,
        "invoice_text": invoice_text,
        "bol_text": bol_text,
        "doc_hash": doc_hash.hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await firebase_service.create_shipment(shipment.shipment_id, shipment_data)

    # Anchor initial document hash on blockchain
    tx_result = await blockchain_service.append_checkpoint(
        shipment_id=shipment.shipment_id,
        location_code=shipment.origin,
        weight_kg=0,
        document_hash=doc_hash,
    )

    if tx_result.get("tx_hash"):
        shipment_data["blockchain_tx_hashes"].append(tx_result["tx_hash"])
        await firebase_service.update_shipment(
            shipment.shipment_id,
            {"blockchain_tx_hashes": shipment_data["blockchain_tx_hashes"]},
        )

    return {
        "shipment": shipment_data,
        "classification": risk_profile,
        "blockchain_tx": tx_result,
    }


@router.get("/", response_model=list[dict])
async def list_shipments(user: UserContext = Depends(get_current_user)):
    """List shipments filtered by role."""
    all_shipments = await firebase_service.list_shipments()

    if user.role == "manufacturer":
        return [s for s in all_shipments if s.get("manufacturer_id") == user.user_id]
    elif user.role == "receiver":
        return [s for s in all_shipments if s.get("receiver_id") == user.user_id]
    elif user.role == "transit_node":
        user_nodes = set(user.node_codes)
        return [
            s for s in all_shipments
            if any(
                node.get("location_code") in user_nodes
                for node in s.get("route", [])
            )
        ]
    return all_shipments


@router.get("/{shipment_id}", response_model=dict)
async def get_shipment(shipment_id: str, user: UserContext = Depends(get_current_user)):
    """Get a single shipment by ID (access controlled)."""
    shipment = await firebase_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if user.role == "manufacturer" and shipment.get("manufacturer_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not your shipment")
    elif user.role == "receiver" and shipment.get("receiver_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not assigned to you")

    return shipment


# ─── Tamper Endpoint (for hackathon demo) ─────────────────


from pydantic import BaseModel
from typing import Optional


class TamperRequest(BaseModel):
    """Modify document texts to simulate in-transit tampering."""
    po_text: Optional[str] = None
    invoice_text: Optional[str] = None
    bol_text: Optional[str] = None


@router.put("/{shipment_id}/tamper", response_model=dict)
async def tamper_shipment(
    shipment_id: str,
    tamper: TamperRequest,
):
    """
    DEMO ONLY: Tamper with a shipment's documents.
    Modifies the stored document texts WITHOUT updating the blockchain hash.
    The next checkpoint will detect the hash mismatch and flag an anomaly.
    """
    shipment = await firebase_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.get("current_status") == "delivered":
        raise HTTPException(status_code=400, detail="Cannot tamper delivered shipment")

    # Modify the stored texts
    updates: dict = {}
    if tamper.po_text is not None:
        updates["po_text"] = tamper.po_text
    if tamper.invoice_text is not None:
        updates["invoice_text"] = tamper.invoice_text
    if tamper.bol_text is not None:
        updates["bol_text"] = tamper.bol_text

    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")

    await firebase_service.update_shipment(shipment_id, updates)

    # Recompute hash from tampered texts (for display only)
    new_po = updates.get("po_text", shipment.get("po_text", ""))
    new_inv = updates.get("invoice_text", shipment.get("invoice_text", ""))
    new_bol = updates.get("bol_text", shipment.get("bol_text", ""))
    new_hash = compute_doc_hash(new_po, new_inv, new_bol).hex()

    return {
        "status": "tampered",
        "shipment_id": shipment_id,
        "original_hash": shipment.get("doc_hash"),
        "tampered_hash": new_hash,
        "warning": "Document texts modified. Next checkpoint will detect hash mismatch.",
        "changes": updates,
    }
