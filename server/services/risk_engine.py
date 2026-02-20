"""
Risk Engine — Deterministic anomaly detection.

Evaluates checkpoint telemetry against the shipment's risk policy.
Returns a list of anomalies (empty if all clear).
"""

from config.risk_policies import get_policy
from models.telemetry_model import AnomalyRecord
from datetime import datetime


def evaluate_checkpoint(
    shipment_id: str,
    product_category: str,
    location_code: str,
    temperature: float | None,
    humidity: float | None,
    weight_kg: float,
    expected_weight_kg: float | None = None,
    delay_hours: float = 0,
) -> list[AnomalyRecord]:
    """
    Evaluate a single checkpoint against deterministic risk policies.
    Returns empty list if no anomalies.
    """
    policy = get_policy(product_category)
    anomalies: list[AnomalyRecord] = []
    now = datetime.utcnow()

    # Temperature breach
    if temperature is not None and "temperature_range" in policy:
        min_temp, max_temp = policy["temperature_range"]
        if temperature < min_temp or temperature > max_temp:
            anomalies.append(AnomalyRecord(
                shipment_id=shipment_id,
                anomaly_type="TEMPERATURE_BREACH",
                severity=_temp_severity(temperature, min_temp, max_temp),
                details={
                    "observed_temperature": temperature,
                    "allowed_range": f"{min_temp}-{max_temp}",
                    "product_category": product_category,
                },
                location_code=location_code,
                created_at=now,
            ))

    # Humidity breach
    if humidity is not None and "humidity_max_pct" in policy:
        if humidity > policy["humidity_max_pct"]:
            anomalies.append(AnomalyRecord(
                shipment_id=shipment_id,
                anomaly_type="HUMIDITY_BREACH",
                severity="MEDIUM",
                details={
                    "observed_humidity": humidity,
                    "max_allowed": policy["humidity_max_pct"],
                },
                location_code=location_code,
                created_at=now,
            ))

    # Weight deviation
    if expected_weight_kg and "weight_tolerance_pct" in policy:
        tolerance = policy["weight_tolerance_pct"]
        deviation_pct = abs(weight_kg - expected_weight_kg) / expected_weight_kg * 100
        if deviation_pct > tolerance:
            anomalies.append(AnomalyRecord(
                shipment_id=shipment_id,
                anomaly_type="WEIGHT_DEVIATION",
                severity="HIGH" if deviation_pct > tolerance * 2 else "MEDIUM",
                details={
                    "observed_weight_kg": weight_kg,
                    "expected_weight_kg": expected_weight_kg,
                    "deviation_pct": round(deviation_pct, 2),
                    "tolerance_pct": tolerance,
                },
                location_code=location_code,
                created_at=now,
            ))

    # Delay
    if delay_hours > 0 and "max_delay_hours" in policy:
        if delay_hours > policy["max_delay_hours"]:
            anomalies.append(AnomalyRecord(
                shipment_id=shipment_id,
                anomaly_type="DELAY",
                severity="HIGH" if delay_hours > policy["max_delay_hours"] * 2 else "MEDIUM",
                details={
                    "delay_hours": delay_hours,
                    "max_allowed_hours": policy["max_delay_hours"],
                },
                location_code=location_code,
                created_at=now,
            ))

    return anomalies


def _temp_severity(observed: float, min_t: float, max_t: float) -> str:
    """Determine severity based on how far outside the range."""
    range_size = max_t - min_t
    if range_size == 0:
        return "CRITICAL"
    if observed < min_t:
        deviation = min_t - observed
    else:
        deviation = observed - max_t
    ratio = deviation / range_size
    if ratio > 1.0:
        return "CRITICAL"
    elif ratio > 0.5:
        return "HIGH"
    else:
        return "MEDIUM"
