from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RouteNode(BaseModel):
    """A single node in the shipment route."""
    location_code: str
    name: str
    expected_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    eta: Optional[datetime] = None


class RiskProfile(BaseModel):
    """AI-classified risk profile from document reconciliation."""
    product_category: str
    risk_flags: list[str] = []
    hazard_class: Optional[str] = None
    compliance_required: list[str] = []
    confidence_score: float = 0.0


class ShipmentCreate(BaseModel):
    """Input for creating a new shipment."""
    shipment_id: str = Field(..., description="Unique shipment identifier")
    origin: str
    destination: str
    receiver_id: str = Field(..., description="User ID of the receiver")
    route: list[RouteNode] = Field(default=[], description="If empty, auto-generated from origin/destination")
    po_text: Optional[str] = None
    invoice_text: Optional[str] = None
    bol_text: Optional[str] = None


class ShipmentResponse(BaseModel):
    """Full shipment record returned to clients."""
    shipment_id: str
    origin: str
    destination: str
    manufacturer_id: str = ""
    receiver_id: str = ""
    route: list[RouteNode]
    risk_profile: Optional[RiskProfile] = None
    current_status: str = "created"
    created_at: Optional[datetime] = None
    blockchain_tx_hashes: list[str] = []
