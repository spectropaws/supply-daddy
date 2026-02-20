"""
Auth routes — Register, login, and user info.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from models.user_model import UserRegister, UserLogin
from services import firebase_service
from services.auth_service import hash_password, verify_password, create_token, generate_user_id
from services.auth_middleware import get_current_user, UserContext
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Auth"])

VALID_ROLES = {"manufacturer", "transit_node", "receiver"}


@router.post("/register", response_model=dict)
async def register(data: UserRegister):
    """Register a new user with email + password + role."""
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    existing = await firebase_service.get_user_by_email(data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if data.role == "transit_node" and not data.node_codes:
        raise HTTPException(status_code=400, detail="Transit nodes must select at least one node to operate")

    user_id = generate_user_id()
    user_data = {
        "user_id": user_id,
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "node_codes": data.node_codes if data.role == "transit_node" else [],
        "created_at": datetime.utcnow().isoformat(),
    }

    await firebase_service.create_user(user_id, user_data)
    token = create_token(user_id, data.role, data.username)

    return {
        "token": token,
        "user": {
            "user_id": user_id,
            "username": data.username,
            "email": data.email,
            "role": data.role,
            "node_codes": user_data["node_codes"],
        },
    }


@router.post("/login", response_model=dict)
async def login(data: UserLogin):
    """Login with email + password."""
    user = await firebase_service.get_user_by_email(data.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["user_id"], user["role"], user["username"])

    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "node_codes": user.get("node_codes", []),
        },
    }


@router.get("/me", response_model=dict)
async def get_me(user: UserContext = Depends(get_current_user)):
    """Get current authenticated user profile."""
    user_data = await firebase_service.get_user(user.user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user_data["user_id"],
        "username": user_data["username"],
        "email": user_data["email"],
        "role": user_data["role"],
        "node_codes": user_data.get("node_codes", []),
    }


@router.get("/users/receivers", response_model=list[dict])
async def list_receivers():
    """List all registered receivers (for manufacturer shipment assignment)."""
    users = await firebase_service.list_users_by_role("receiver")
    return [{"user_id": u["user_id"], "username": u["username"], "email": u["email"]} for u in users]
