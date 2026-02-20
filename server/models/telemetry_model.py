from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CheckpointInput(BaseModel):
    """Telemetry data sent by a transit node at check-in."""
    shipment_id: str
    location_code: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    weight_kg: float
    timestamp: Optional[datetime] = None  # defaults to server time


class AnomalyRecord(BaseModel):
    """An anomaly detected during checkpoint evaluation."""
    shipment_id: str
    anomaly_type: str  # TEMPERATURE_BREACH, WEIGHT_DEVIATION, DELAY, HUMIDITY_BREACH
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    details: dict = {}
    location_code: str = ""
    resolved: bool = False
    created_at: Optional[datetime] = None
    genai_assessment: Optional[dict] = None


class GodModeDelay(BaseModel):
    """God Mode: inject a delay at a node."""
    shipment_id: str
    node_index: int
    delay_hours: float


class GodModeTemperature(BaseModel):
    """God Mode: inject a temperature breach."""
    shipment_id: str
    location_code: str
    observed_temperature: float


class GodModeWeight(BaseModel):
    """God Mode: inject weight loss."""
    shipment_id: str
    location_code: str
    observed_weight_kg: float
