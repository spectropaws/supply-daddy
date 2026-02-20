"""
Shipment routes — Create, list, and retrieve shipments.
Now with auth-based filtering and auto-route generation.
"""

import hashlib
from fastapi import APIRouter, HTTPException, Depends
from models.shipment_model import ShipmentCreate
from services import firebase_service, genai_service, blockchain_service
from services.pii_masking import PIIMasker
from services.auth_middleware import get_current_user, require_role, UserContext
from services.route_graph import find_optimal_route

router = APIRouter(prefix="/shipments", tags=["Shipments"])


@router.post("/", response_model=dict)
async def create_shipment(
    shipment: ShipmentCreate,
    user: UserContext = Depends(require_role("manufacturer")),
):
    """
    Create a new shipment (manufacturer only).
    Auto-generates optimal route if route is empty.
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

    # If documents provided, run GenAI classification
    if shipment.po_text or shipment.invoice_text or shipment.bol_text:
        masker = PIIMasker()
        masked_po = masker.mask_text(shipment.po_text or "")
        masked_inv = masker.mask_text(shipment.invoice_text or "")
        masked_bol = masker.mask_text(shipment.bol_text or "")

        classification = await genai_service.classify_shipment(
            masked_po, masked_inv, masked_bol
        )
        classification = masker.unmask_dict(classification)

        risk_profile = {
            "product_category": classification.get("product_category", "default"),
            "risk_flags": classification.get("risk_flags", []),
            "hazard_class": classification.get("hazard_class"),
            "compliance_required": classification.get("compliance_required", []),
            "confidence_score": classification.get("confidence_score", 0.0),
        }

    # Build shipment data
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
    }

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
async def list_shipments(user: UserContext = Depends(get_current_user)):
    """
    List shipments filtered by role:
    - manufacturer: own shipments
    - receiver: assigned shipments
    - transit_node: shipments passing through their nodes
    """
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

    # Access check
    if user.role == "manufacturer" and shipment.get("manufacturer_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not your shipment")
    elif user.role == "receiver" and shipment.get("receiver_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not assigned to you")

    return shipment
