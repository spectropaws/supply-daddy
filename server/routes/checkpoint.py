"""
Checkpoint routes — Register transit node check-ins.
"""

import hashlib
from datetime import datetime
from fastapi import APIRouter
from models.telemetry_model import CheckpointInput
from services import firebase_service, blockchain_service, genai_service
from services.risk_engine import evaluate_checkpoint
from services.eta_engine import propagate_delay

router = APIRouter(prefix="/checkpoints", tags=["Checkpoints"])


@router.post("/", response_model=dict)
async def register_checkpoint(checkpoint: CheckpointInput):
    """
    Register a checkpoint from a transit node.

    1. Fetch shipment risk profile
    2. Evaluate deterministic anomaly rules
    3. If clean → store telemetry + anchor on blockchain
    4. If anomaly → store anomaly + trigger GenAI interpretation
    """
    # Fetch shipment
    shipment = await firebase_service.get_shipment(checkpoint.shipment_id)
    if not shipment:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shipment not found")

    risk_profile = shipment.get("risk_profile", {})
    product_category = risk_profile.get("product_category", "default")

    # Calculate delay if we can match the route node
    delay_hours = 0.0
    node_index = -1
    route = shipment.get("route", [])
    for i, node in enumerate(route):
        if node.get("location_code") == checkpoint.location_code:
            node_index = i
            if node.get("expected_arrival"):
                try:
                    expected = datetime.fromisoformat(node["expected_arrival"])
                    actual = checkpoint.timestamp or datetime.utcnow()
                    delta = (actual - expected).total_seconds() / 3600
                    if delta > 0:
                        delay_hours = delta
                except (ValueError, TypeError):
                    pass
            # Update actual arrival
            node["actual_arrival"] = (checkpoint.timestamp or datetime.utcnow()).isoformat()
            break

    # Find expected weight from first checkpoint or shipment data
    expected_weight = None
    telemetry_records = await firebase_service.get_telemetry(checkpoint.shipment_id)
    if telemetry_records:
        expected_weight = telemetry_records[0].get("weight_kg")

    # Evaluate anomaly rules
    anomalies = evaluate_checkpoint(
        shipment_id=checkpoint.shipment_id,
        product_category=product_category,
        location_code=checkpoint.location_code,
        temperature=checkpoint.temperature,
        humidity=checkpoint.humidity,
        weight_kg=checkpoint.weight_kg,
        expected_weight_kg=expected_weight,
        delay_hours=delay_hours,
    )

    # Store telemetry
    telemetry_data = {
        "location_code": checkpoint.location_code,
        "temperature": checkpoint.temperature,
        "humidity": checkpoint.humidity,
        "weight_kg": checkpoint.weight_kg,
        "timestamp": (checkpoint.timestamp or datetime.utcnow()).isoformat(),
    }
    await firebase_service.add_telemetry(checkpoint.shipment_id, telemetry_data)

    # Anchor on blockchain
    doc_hash = hashlib.sha256(
        f"{checkpoint.shipment_id}:{checkpoint.location_code}".encode()
    ).digest()
    tx_result = await blockchain_service.append_checkpoint(
        shipment_id=checkpoint.shipment_id,
        location_code=checkpoint.location_code,
        weight_kg=int(checkpoint.weight_kg),
        document_hash=doc_hash,
    )

    # Update shipment tx hashes
    if tx_result.get("tx_hash"):
        tx_hashes = shipment.get("blockchain_tx_hashes", [])
        tx_hashes.append(tx_result["tx_hash"])
        await firebase_service.update_shipment(
            checkpoint.shipment_id, {"blockchain_tx_hashes": tx_hashes}
        )

    # ETA propagation if there's a delay
    if delay_hours > 0 and node_index >= 0:
        updated_route = propagate_delay(route, node_index, delay_hours)
        await firebase_service.update_shipment(
            checkpoint.shipment_id,
            {"route": updated_route, "current_status": "in_transit"},
        )
    elif node_index >= 0:
        await firebase_service.update_shipment(
            checkpoint.shipment_id,
            {"route": route, "current_status": "in_transit"},
        )

    # Process anomalies
    genai_assessments = []
    for anomaly in anomalies:
        anomaly_dict = anomaly.model_dump(mode="json")
        await firebase_service.add_anomaly(anomaly_dict)

        # Trigger GenAI for anomaly interpretation
        genai_context = {
            "product_category": product_category,
            "anomaly": anomaly.anomaly_type,
            "location": checkpoint.location_code,
            **anomaly.details,
        }
        assessment = await genai_service.interpret_anomaly(genai_context)
        genai_assessments.append(assessment)

        # Update anomaly with GenAI assessment
        anomaly_dict["genai_assessment"] = assessment
        await firebase_service.add_anomaly(anomaly_dict)

    return {
        "status": "anomaly_detected" if anomalies else "ok",
        "checkpoint": telemetry_data,
        "blockchain_tx": tx_result,
        "anomalies": [a.model_dump(mode="json") for a in anomalies],
        "genai_assessments": genai_assessments,
        "delay_hours": delay_hours,
    }
