"""
Shipment routes — Create, list, and retrieve shipments.
"""

import hashlib
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from models.shipment_model import ShipmentCreate, ShipmentResponse, RiskProfile
from services import firebase_service, genai_service, blockchain_service
from services.pii_masking import PIIMasker

router = APIRouter(prefix="/shipments", tags=["Shipments"])


@router.post("/", response_model=dict)
async def create_shipment(shipment: ShipmentCreate):
    """
    Create a new shipment.
    If document texts (po_text, invoice_text, bol_text) are provided,
    they are sent through PII masking → Gemini classification.
    """
    # Check if shipment already exists
    existing = await firebase_service.get_shipment(shipment.shipment_id)
    if existing:
        raise HTTPException(status_code=409, detail="Shipment already exists")

    risk_profile = None

    # If documents provided, run GenAI classification
    if shipment.po_text or shipment.invoice_text or shipment.bol_text:
        masker = PIIMasker()
        masked_po = masker.mask_text(shipment.po_text or "")
        masked_inv = masker.mask_text(shipment.invoice_text or "")
        masked_bol = masker.mask_text(shipment.bol_text or "")

        classification = await genai_service.classify_shipment(
            masked_po, masked_inv, masked_bol
        )
        # Unmask any PII that leaked into the response
        classification = masker.unmask_dict(classification)

        risk_profile = {
            "product_category": classification.get("product_category", "default"),
            "risk_flags": classification.get("risk_flags", []),
            "hazard_class": classification.get("hazard_class"),
            "compliance_required": classification.get("compliance_required", []),
            "confidence_score": classification.get("confidence_score", 0.0),
        }

    # Build shipment data
    route_dicts = [node.model_dump(mode="json") for node in shipment.route]
    shipment_data = {
        "shipment_id": shipment.shipment_id,
        "origin": shipment.origin,
        "destination": shipment.destination,
        "route": route_dicts,
        "risk_profile": risk_profile,
        "current_status": "created",
        "blockchain_tx_hashes": [],
    }

    # Store in Firebase
    await firebase_service.create_shipment(shipment.shipment_id, shipment_data)

    # Anchor initial checkpoint on blockchain
    doc_hash = hashlib.sha256(
        f"{shipment.shipment_id}:created".encode()
    ).digest()
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
async def list_shipments():
    """List all shipments."""
    shipments = await firebase_service.list_shipments()
    return shipments


@router.get("/{shipment_id}", response_model=dict)
async def get_shipment(shipment_id: str):
    """Get a single shipment by ID."""
    shipment = await firebase_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment
