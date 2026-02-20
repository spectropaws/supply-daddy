"""
Auth Middleware — FastAPI dependencies for route protection.
"""

from fastapi import Request, HTTPException, Depends
from services.auth_service import decode_token
from services import firebase_service


class UserContext:
    """Authenticated user context injected into route handlers."""
    def __init__(self, user_id: str, username: str, role: str, node_codes: list[str] | None = None):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.node_codes = node_codes or []


async def get_current_user(request: Request) -> UserContext:
    """Extract and validate JWT from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header[7:]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await firebase_service.get_user(payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return UserContext(
        user_id=user["user_id"],
        username=user["username"],
        role=user["role"],
        node_codes=user.get("node_codes", []),
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
