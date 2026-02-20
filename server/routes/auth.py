"""
Auth routes — Firebase Auth integration.
Handles user profile setup (role selection) after Firebase authentication.
"""

import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from services import firebase_service
from services.auth_middleware import get_current_user, UserContext

logger = logging.getLogger(__name__)

# Firebase Admin Auth for token verification
try:
    from firebase_admin import auth as firebase_auth
    _HAS_FIREBASE_AUTH = True
except ImportError:
    _HAS_FIREBASE_AUTH = False

router = APIRouter(prefix="/auth", tags=["Auth"])

VALID_ROLES = {"manufacturer", "transit_node", "receiver"}


class RoleSetup(BaseModel):
    role: str
    node_codes: list[str] = []


@router.post("/setup-role", response_model=dict)
async def setup_role(data: RoleSetup, request: Request):
    """
    Set up user role after Firebase authentication.
    Called when a user signs in for the first time (no profile in our DB).
    """
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    if data.role == "transit_node" and not data.node_codes:
        raise HTTPException(status_code=400, detail="Transit nodes must select at least one node")

    # Verify the Firebase ID token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    id_token = auth_header[7:]

    if not _HAS_FIREBASE_AUTH:
        raise HTTPException(status_code=500, detail="Firebase Auth not available")

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")
    display_name = decoded.get("name", "") or decoded.get("email", "user")

    # Check if user already exists
    existing = await firebase_service.get_user_by_firebase_uid(firebase_uid)
    if existing:
        raise HTTPException(status_code=409, detail="User profile already exists")

    user_id = str(uuid.uuid4())[:8]
    user_data = {
        "user_id": user_id,
        "firebase_uid": firebase_uid,
        "username": display_name,
        "email": email,
        "role": data.role,
        "node_codes": data.node_codes if data.role == "transit_node" else [],
        "created_at": datetime.utcnow().isoformat(),
    }

    await firebase_service.create_user(user_id, user_data)
    logger.info(f"Created user profile: {user_id} ({email}) as {data.role}")

    return {
        "user": {
            "user_id": user_id,
            "username": display_name,
            "email": email,
            "role": data.role,
            "node_codes": user_data["node_codes"],
        },
    }


@router.get("/me", response_model=dict)
async def get_me(user: UserContext = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "node_codes": user.node_codes,
    }


@router.get("/users/receivers", response_model=list[dict])
async def list_receivers():
    """List all registered receivers (for manufacturer shipment assignment)."""
    users = await firebase_service.list_users_by_role("receiver")
    return [{"user_id": u["user_id"], "username": u["username"], "email": u["email"]} for u in users]
