"""
Anomaly routes — List anomalies and God Mode injection endpoints.
GenAI calls are wrapped with timeouts to prevent blocking.
"""

import asyncio
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from models.telemetry_model import (
    AnomalyRecord,
    GodModeDelay,
    GodModeTemperature,
    GodModeWeight,
)
from services import firebase_service, genai_service, blockchain_service
from services.risk_engine import evaluate_checkpoint
from services.eta_engine import propagate_delay
from services.auth_middleware import get_current_user, UserContext

router = APIRouter(tags=["Anomalies"])


@router.get("/anomalies/{shipment_id}", response_model=list[dict])
async def list_anomalies(shipment_id: str, user: UserContext = Depends(get_current_user)):
    """Get all anomalies for a shipment if authorized."""
    shipment = await firebase_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
        
    if user.role not in ["manufacturer", "receiver"]:
        raise HTTPException(status_code=403, detail="Unauthorized role for risk alerts")
    
    if user.role == "manufacturer" and shipment.get("manufacturer_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not the manufacturer for this shipment")
    if user.role == "receiver" and shipment.get("receiver_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not the receiver for this shipment")

    anomalies = await firebase_service.get_anomalies(shipment_id)
    return anomalies


@router.get("/anomalies", response_model=list[dict])
async def list_all_anomalies(user: UserContext = Depends(get_current_user)):
    """Get all anomalies for shipments the user is involved in."""
    if user.role not in ["manufacturer", "receiver"]:
        return []

    all_shipments = await firebase_service.list_shipments()
    valid_shipment_ids = set()
    
    for s in all_shipments:
        if user.role == "manufacturer" and s.get("manufacturer_id") == user.user_id:
            valid_shipment_ids.add(s.get("shipment_id"))
        elif user.role == "receiver" and s.get("receiver_id") == user.user_id:
            valid_shipment_ids.add(s.get("shipment_id"))

    all_anomalies = await firebase_service.get_all_anomalies()
    return [a for a in all_anomalies if a.get("shipment_id") in valid_shipment_ids]


async def _safe_genai(context: dict, timeout: float = 5.0) -> dict | None:
    """Call GenAI interpret_anomaly with a timeout to prevent blocking."""
    try:
        return await asyncio.wait_for(
            genai_service.interpret_anomaly(context),
            timeout=timeout,
        )
    except (asyncio.TimeoutError, Exception):
        return None


# ─── God Mode Endpoints ──────────────────────────────────

@router.post("/god-mode/delay", response_model=dict)
async def inject_delay(payload: GodModeDelay):
    """
    God Mode: Inject a delay at a specific route node.
    Triggers ETA ripple effect and anomaly if policy is breached.
    """
    shipment = await firebase_service.get_shipment(payload.shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    route = shipment.get("route", [])
    if payload.node_index >= len(route):
        raise HTTPException(status_code=400, detail="Invalid node index")

    risk_profile = shipment.get("risk_profile", {})
    product_category = risk_profile.get("product_category", "default")
    node = route[payload.node_index]

    # Evaluate delay anomaly
    anomalies = evaluate_checkpoint(
        shipment_id=payload.shipment_id,
        product_category=product_category,
        location_code=node.get("location_code", "unknown"),
        temperature=None,
        humidity=None,
        weight_kg=0,
        delay_hours=payload.delay_hours,
    )

    # Propagate ETA
    updated_route = propagate_delay(route, payload.node_index, payload.delay_hours)
    await firebase_service.update_shipment(
        payload.shipment_id, {"route": updated_route}
    )

    # Process anomalies (with timeout on GenAI)
    genai_assessments = []
    for anomaly in anomalies:
        anomaly_dict = anomaly.model_dump(mode="json")
        await firebase_service.add_anomaly(anomaly_dict)

        assessment = await _safe_genai({
            "product_category": product_category,
            "anomaly": anomaly.anomaly_type,
            "delay_hours": payload.delay_hours,
            "location": node.get("location_code", "unknown"),
        })
        if assessment:
            genai_assessments.append(assessment)
            anomaly_dict["genai_assessment"] = assessment
            await firebase_service.add_anomaly(anomaly_dict)

    return {
        "status": "delay_injected",
        "delay_hours": payload.delay_hours,
        "updated_route": updated_route,
        "anomalies": [a.model_dump(mode="json") for a in anomalies],
        "genai_assessments": genai_assessments,
    }


@router.post("/god-mode/temperature", response_model=dict)
async def inject_temperature(payload: GodModeTemperature):
    """
    God Mode: Inject a temperature breach at a location.
    """
    shipment = await firebase_service.get_shipment(payload.shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    risk_profile = shipment.get("risk_profile", {})
    product_category = risk_profile.get("product_category", "default")

    anomalies = evaluate_checkpoint(
        shipment_id=payload.shipment_id,
        product_category=product_category,
        location_code=payload.location_code,
        temperature=payload.observed_temperature,
        humidity=None,
        weight_kg=0,
    )

    # Anchor on blockchain
    doc_hash = hashlib.sha256(
        f"{payload.shipment_id}:temp_breach:{payload.location_code}".encode()
    ).digest()
    tx_result = await blockchain_service.append_checkpoint(
        shipment_id=payload.shipment_id,
        location_code=payload.location_code,
        weight_kg=0,
        document_hash=doc_hash,
    )

    genai_assessments = []
    for anomaly in anomalies:
        anomaly_dict = anomaly.model_dump(mode="json")
        await firebase_service.add_anomaly(anomaly_dict)

        assessment = await _safe_genai({
            "product_category": product_category,
            "anomaly": anomaly.anomaly_type,
            "observed_temperature": payload.observed_temperature,
            "allowed_range": anomaly.details.get("allowed_range", ""),
            "location": payload.location_code,
        })
        if assessment:
            genai_assessments.append(assessment)
            anomaly_dict["genai_assessment"] = assessment
            await firebase_service.add_anomaly(anomaly_dict)

    return {
        "status": "temperature_breach_injected",
        "observed_temperature": payload.observed_temperature,
        "blockchain_tx": tx_result,
        "anomalies": [a.model_dump(mode="json") for a in anomalies],
        "genai_assessments": genai_assessments,
    }


@router.post("/god-mode/weight", response_model=dict)
async def inject_weight_loss(payload: GodModeWeight):
    """
    God Mode: Inject a weight deviation at a location.
    """
    shipment = await firebase_service.get_shipment(payload.shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    risk_profile = shipment.get("risk_profile", {})
    product_category = risk_profile.get("product_category", "default")

    # Get expected weight from telemetry
    telemetry = await firebase_service.get_telemetry(payload.shipment_id)
    expected_weight = telemetry[0]["weight_kg"] if telemetry else 1000  # fallback

    anomalies = evaluate_checkpoint(
        shipment_id=payload.shipment_id,
        product_category=product_category,
        location_code=payload.location_code,
        temperature=None,
        humidity=None,
        weight_kg=payload.observed_weight_kg,
        expected_weight_kg=expected_weight,
    )

    # Anchor on blockchain
    doc_hash = hashlib.sha256(
        f"{payload.shipment_id}:weight_loss:{payload.location_code}".encode()
    ).digest()
    tx_result = await blockchain_service.append_checkpoint(
        shipment_id=payload.shipment_id,
        location_code=payload.location_code,
        weight_kg=int(payload.observed_weight_kg),
        document_hash=doc_hash,
    )

    genai_assessments = []
    for anomaly in anomalies:
        anomaly_dict = anomaly.model_dump(mode="json")
        await firebase_service.add_anomaly(anomaly_dict)

        assessment = await _safe_genai({
            "product_category": product_category,
            "anomaly": anomaly.anomaly_type,
            "observed_weight_kg": payload.observed_weight_kg,
            "expected_weight_kg": expected_weight,
            "location": payload.location_code,
        })
        if assessment:
            genai_assessments.append(assessment)
            anomaly_dict["genai_assessment"] = assessment
            await firebase_service.add_anomaly(anomaly_dict)

    return {
        "status": "weight_loss_injected",
        "observed_weight_kg": payload.observed_weight_kg,
        "expected_weight_kg": expected_weight,
        "blockchain_tx": tx_result,
        "anomalies": [a.model_dump(mode="json") for a in anomalies],
        "genai_assessments": genai_assessments,
    }
