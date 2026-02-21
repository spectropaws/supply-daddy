"""
Auth Middleware — FastAPI dependencies for route protection.
Verifies Firebase ID tokens from the Authorization header.
"""

import asyncio
import logging
from fastapi import Request, HTTPException, Depends
from services import firebase_service

logger = logging.getLogger(__name__)

# Try Firebase Admin Auth
try:
    from firebase_admin import auth as firebase_auth
    _HAS_FIREBASE_AUTH = True
except ImportError:
    _HAS_FIREBASE_AUTH = False
    logger.warning("firebase_admin.auth not available — auth verification disabled")


class UserContext:
    """Authenticated user context injected into route handlers."""
    def __init__(self, user_id: str, username: str, role: str, email: str = "",
                 node_codes: list[str] | None = None, firebase_uid: str = ""):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.email = email
        self.node_codes = node_codes or []
        self.firebase_uid = firebase_uid


async def get_current_user(request: Request) -> UserContext:
    """Extract and verify Firebase ID token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    id_token = auth_header[7:]

    if not _HAS_FIREBASE_AUTH:
        raise HTTPException(status_code=500, detail="Firebase Auth not available on server")

    try:
        decoded = await asyncio.to_thread(firebase_auth.verify_id_token, id_token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")

    # Look up user in our database by firebase_uid
    user = await firebase_service.get_user_by_firebase_uid(firebase_uid)
    if not user:
        # Also try by email (for users who registered before this change)
        user = await firebase_service.get_user_by_email(email)

    if not user:
        raise HTTPException(status_code=404, detail="User profile not found. Please complete role setup.")

    return UserContext(
        user_id=user["user_id"],
        username=user.get("username", ""),
        role=user["role"],
        email=user.get("email", email),
        node_codes=user.get("node_codes", []),
        firebase_uid=firebase_uid,
    )


def require_role(*roles: str):
    """Dependency factory: restrict endpoint to specific roles."""
    async def dependency(user: UserContext = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role}' not authorized. Required: {roles}",
            )
        return user
    return dependency


async def get_optional_user(request: Request) -> UserContext | None:
    """Optional auth — returns None if no valid token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
