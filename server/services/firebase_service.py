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
    from firebase_admin import credentials, firestore, storage
    _HAS_FIREBASE = True
except ImportError:
    _HAS_FIREBASE = False
    logger.warning("firebase-admin not installed — using in-memory store")

_db = None
_bucket_name = None

# In-memory fallback store
_mem_store: dict[str, dict[str, dict]] = {
    "shipments": {},
    "telemetry": {},
    "anomalies": {},
    "users": {},
    "storage": {},  # For local dev PDF bytes
}


def init_firebase():
    """Initialize Firebase Admin SDK."""
    global _db, _bucket_name

    if not _HAS_FIREBASE:
        logger.info("Using in-memory store (no firebase-admin)")
        return

    cred_path = os.getenv("FIREBASE_CREDENTIALS", "")
    _bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "")
    
    if not cred_path or not os.path.exists(cred_path):
        logger.warning("FIREBASE_CREDENTIALS not set or file missing — using in-memory store")
        return

    try:
        cred = credentials.Certificate(cred_path)
        options = {}
        if _bucket_name:
            options["storageBucket"] = _bucket_name
            
        firebase_admin.initialize_app(cred, options)
        _db = firestore.client()
        logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Firebase init error: {e}")
        _db = None


# ─── Storage (PDFs) ───────────────────────────────────────

async def upload_pdf(file_bytes: bytes, destination_path: str, content_type: str = "application/pdf") -> str:
    """Upload PDF bytes to Firebase Storage and return the public URL."""
    if not _db:
        # In-memory mock
        _mem_store["storage"][destination_path] = file_bytes
        return f"mock-url://{destination_path}"
        
    try:
        bucket = storage.bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        logger.error(f"Storage upload error for {destination_path}: {e}")
        return ""


async def download_pdf(destination_path: str) -> bytes | None:
    """Download PDF bytes from Firebase Storage."""
    if not _db:
        # In-memory mock
        return _mem_store["storage"].get(destination_path)
        
    try:
        bucket = storage.bucket()
        blob = bucket.blob(destination_path)
        if not blob.exists():
            return None
        return blob.download_as_bytes()
    except Exception as e:
        logger.error(f"Storage download error for {destination_path}: {e}")
        return None


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


# ─── Users ────────────────────────────────────────────────

async def create_user(user_id: str, data: dict) -> dict:
    """Create a user document."""
    if _db:
        _db.collection("users").document(user_id).set(data)
    else:
        _mem_store["users"][user_id] = data
    return data


async def get_user(user_id: str) -> dict | None:
    """Retrieve a user by ID."""
    if _db:
        doc = _db.collection("users").document(user_id).get()
        return doc.to_dict() if doc.exists else None
    return _mem_store["users"].get(user_id)


async def get_user_by_email(email: str) -> dict | None:
    """Find a user by email."""
    if _db:
        docs = _db.collection("users").where("email", "==", email).limit(1).stream()
        for doc in docs:
            return doc.to_dict()
        return None
    for u in _mem_store["users"].values():
        if u.get("email") == email:
            return u
    return None


async def get_user_by_firebase_uid(firebase_uid: str) -> dict | None:
    """Find a user by Firebase UID."""
    if _db:
        docs = _db.collection("users").where("firebase_uid", "==", firebase_uid).limit(1).stream()
        for doc in docs:
            return doc.to_dict()
        return None
    for u in _mem_store["users"].values():
        if u.get("firebase_uid") == firebase_uid:
            return u
    return None


async def list_users_by_role(role: str) -> list[dict]:
    """List all users with a specific role."""
    if _db:
        docs = _db.collection("users").where("role", "==", role).stream()
        return [doc.to_dict() for doc in docs]
    return [u for u in _mem_store["users"].values() if u.get("role") == role]

