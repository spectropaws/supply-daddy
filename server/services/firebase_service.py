"""
Firebase Service — Off-chain state management.

Provides CRUD operations for shipments, telemetry, and anomalies collections.
Falls back to in-memory storage if Firebase credentials are not available.
"""

import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Try Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    _HAS_FIREBASE = True
except ImportError:
    _HAS_FIREBASE = False
    logger.warning("firebase-admin not installed — using in-memory store")

_db = None

# In-memory fallback store
_mem_store: dict[str, dict[str, dict]] = {
    "shipments": {},
    "telemetry": {},
    "anomalies": {},
}


def init_firebase():
    """Initialize Firebase Admin SDK."""
    global _db

    if not _HAS_FIREBASE:
        logger.info("Using in-memory store (no firebase-admin)")
        return

    cred_path = os.getenv("FIREBASE_CREDENTIALS", "")
    if not cred_path or not os.path.exists(cred_path):
        logger.warning("FIREBASE_CREDENTIALS not set or file missing — using in-memory store")
        return

    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
        logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Firebase init error: {e}")
        _db = None


# ─── Shipments ────────────────────────────────────────────

async def create_shipment(shipment_id: str, data: dict) -> dict:
    """Create or overwrite a shipment document."""
    data["created_at"] = datetime.utcnow().isoformat()
    if _db:
        _db.collection("shipments").document(shipment_id).set(data)
    else:
        _mem_store["shipments"][shipment_id] = data
    return data


async def get_shipment(shipment_id: str) -> dict | None:
    """Retrieve a single shipment."""
    if _db:
        doc = _db.collection("shipments").document(shipment_id).get()
        return doc.to_dict() if doc.exists else None
    return _mem_store["shipments"].get(shipment_id)


async def list_shipments() -> list[dict]:
    """List all shipments."""
    if _db:
        docs = _db.collection("shipments").stream()
        return [doc.to_dict() for doc in docs]
    return list(_mem_store["shipments"].values())


async def update_shipment(shipment_id: str, updates: dict) -> dict | None:
    """Partially update a shipment."""
    if _db:
        ref = _db.collection("shipments").document(shipment_id)
        ref.update(updates)
        return ref.get().to_dict()
    else:
        if shipment_id in _mem_store["shipments"]:
            _mem_store["shipments"][shipment_id].update(updates)
            return _mem_store["shipments"][shipment_id]
    return None


# ─── Telemetry ────────────────────────────────────────────

async def add_telemetry(shipment_id: str, data: dict) -> dict:
    """Store a telemetry record."""
    data["shipment_id"] = shipment_id
    data["recorded_at"] = datetime.utcnow().isoformat()
    doc_id = f"{shipment_id}_{data.get('location_code', 'unknown')}_{data['recorded_at']}"

    if _db:
        _db.collection("telemetry").document(doc_id).set(data)
    else:
        _mem_store["telemetry"][doc_id] = data
    return data


async def get_telemetry(shipment_id: str) -> list[dict]:
    """Get all telemetry for a shipment."""
    if _db:
        docs = _db.collection("telemetry").where(
            "shipment_id", "==", shipment_id
        ).stream()
        return [doc.to_dict() for doc in docs]
    return [
        v for v in _mem_store["telemetry"].values()
        if v.get("shipment_id") == shipment_id
    ]


# ─── Anomalies ────────────────────────────────────────────

async def add_anomaly(data: dict) -> dict:
    """Store an anomaly record."""
    data["created_at"] = data.get("created_at", datetime.utcnow().isoformat())
    doc_id = f"{data['shipment_id']}_{data['anomaly_type']}_{data['created_at']}"

    if _db:
        _db.collection("anomalies").document(doc_id).set(data)
    else:
        _mem_store["anomalies"][doc_id] = data
    return data


async def get_anomalies(shipment_id: str) -> list[dict]:
    """Get all anomalies for a shipment."""
    if _db:
        docs = _db.collection("anomalies").where(
            "shipment_id", "==", shipment_id
        ).stream()
        return [doc.to_dict() for doc in docs]
    return [
        v for v in _mem_store["anomalies"].values()
        if v.get("shipment_id") == shipment_id
    ]


async def get_all_anomalies() -> list[dict]:
    """Get all anomalies across all shipments."""
    if _db:
        docs = _db.collection("anomalies").stream()
        return [doc.to_dict() for doc in docs]
    return list(_mem_store["anomalies"].values())


async def resolve_anomaly(shipment_id: str, anomaly_type: str) -> bool:
    """Mark anomalies of a given type for a shipment as resolved."""
    if _db:
        docs = _db.collection("anomalies").where(
            "shipment_id", "==", shipment_id
        ).where(
            "anomaly_type", "==", anomaly_type
        ).stream()
        for doc in docs:
            doc.reference.update({"resolved": True})
        return True
    else:
        for v in _mem_store["anomalies"].values():
            if v.get("shipment_id") == shipment_id and v.get("anomaly_type") == anomaly_type:
                v["resolved"] = True
        return True
