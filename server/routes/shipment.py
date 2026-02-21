"""
Shipment routes — Create, list, retrieve, and tamper (demo) shipments.
Now stores document texts and anchors their hash on blockchain.
"""

import uuid
import json
import hashlib
import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from models.shipment_model import ShipmentTamper
from services import firebase_service, genai_service, blockchain_service
from services.pii_masking import PIIMasker
from services.auth_middleware import get_current_user, require_role, UserContext
from services.route_graph import find_optimal_route

router = APIRouter(prefix="/shipments", tags=["Shipments"])


def compute_doc_hash(po_text: str, invoice_text: str, bol_text: str) -> bytes:
    """Deterministic SHA-256 hash of the document texts."""
    combined = po_text + invoice_text + bol_text
    return hashlib.sha256(combined.encode('utf-8')).digest()


@router.post("/", response_model=dict)
async def create_shipment(
    origin: str = Form(...),
    destination: str = Form(...),
    receiver_id: str = Form(...),
    po_file: Optional[UploadFile] = File(None),
    invoice_file: Optional[UploadFile] = File(None),
    bol_file: Optional[UploadFile] = File(None),
    user: UserContext = Depends(require_role("manufacturer")),
):
    """
    Create a new shipment (manufacturer only).
    Accepts PDF file uploads, extracts text server-side, runs AI classification,
    anchors hash on blockchain.
    """
    # Auto-generate short UUID for shipment_id
    shipment_id = f"SHIP-{str(uuid.uuid4())[:8].upper()}"

    # Auto-generate route
    route = find_optimal_route(origin, destination)
    if not route:
        raise HTTPException(
            status_code=400,
            detail=f"No route found between {origin} and {destination}",
        )
    route_dicts = route

    # Extract text from uploaded PDFs server-side
    po_text = ""
    invoice_text = ""
    bol_text = ""
    if po_file:
        po_text = genai_service.extract_text_from_pdf(await po_file.read())
    if invoice_file:
        invoice_text = genai_service.extract_text_from_pdf(await invoice_file.read())
    if bol_file:
        bol_text = genai_service.extract_text_from_pdf(await bol_file.read())

    risk_profile = None

    # Run GenAI classification
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

    # Build shipment data
    shipment_data = {
        "shipment_id": shipment_id,
        "origin": origin,
        "destination": destination,
        "manufacturer_id": user.user_id,
        "receiver_id": receiver_id,
        "route": route_dicts,
        "risk_profile": risk_profile,
        "current_status": "created",
        "blockchain_tx_hashes": [],
        "po_text": po_text,
        "invoice_text": invoice_text,
        "bol_text": bol_text,
        "doc_hash": doc_hash.hex(),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    await firebase_service.create_shipment(shipment_id, shipment_data)

    # Anchor initial document hash on blockchain
    tx_result = await blockchain_service.append_checkpoint(
        shipment_id=shipment_id,
        location_code=origin,
        weight_kg=0,
        document_hash=doc_hash,
    )

    if tx_result.get("tx_hash"):
        shipment_data["blockchain_tx_hashes"].append(tx_result["tx_hash"])
        await firebase_service.update_shipment(
            shipment_id,
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


@router.put("/{shipment_id}/tamper", response_model=dict)
async def tamper_shipment(
    shipment_id: str,
    tamper_data: ShipmentTamper,
):
    """
    DEMO ONLY: Tamper with a shipment's documents.
    Overwrites the document texts in Firestore WITHOUT updating the blockchain hash.
    The next checkpoint will detect the hash mismatch and flag an anomaly.
    """
    shipment = await firebase_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.get("current_status") == "delivered":
        raise HTTPException(status_code=400, detail="Cannot tamper delivered shipment")

    updates: dict = {}
    
    if tamper_data.po_text:
        updates["po_text"] = tamper_data.po_text
    if tamper_data.invoice_text:
        updates["invoice_text"] = tamper_data.invoice_text
    if tamper_data.bol_text:
        updates["bol_text"] = tamper_data.bol_text

    if not updates:
        raise HTTPException(status_code=400, detail="No text provided to tamper")

    await firebase_service.update_shipment(shipment_id, updates)

    # Recompute current actual hash to display in God Mode UI
    current_po = updates.get("po_text", shipment.get("po_text", ""))
    current_inv = updates.get("invoice_text", shipment.get("invoice_text", ""))
    current_bol = updates.get("bol_text", shipment.get("bol_text", ""))
    
    new_hash = compute_doc_hash(current_po, current_inv, current_bol).hex()

    return {
        "status": "tampered",
        "shipment_id": shipment_id,
        "original_hash": shipment.get("doc_hash"),
        "tampered_hash": new_hash,
        "warning": "Document texts overwritten in Firestore. Next checkpoint will detect hash mismatch.",
        "changes": list(updates.keys()),
    }
