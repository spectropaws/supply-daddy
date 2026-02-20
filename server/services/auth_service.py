"""
Auth Service — Password hashing and JWT token management.
Uses stdlib hashlib for password hashing (no bcrypt dep needed).
"""

import hashlib
import hmac
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

try:
    import jwt
    _HAS_JWT = True
except ImportError:
    _HAS_JWT = False
    logger.warning("PyJWT not installed — auth will not work")

JWT_SECRET = os.getenv("JWT_SECRET", "supply-daddy-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72


def hash_password(password: str) -> str:
    """Hash password with PBKDF2-SHA256 + random salt."""
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}:{key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash."""
    try:
        salt_hex, key_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def create_token(user_id: str, role: str, username: str) -> str:
    """Create a JWT token."""
    if not _HAS_JWT:
        return f"stub-token-{user_id}"
    payload = {
        "user_id": user_id,
        "role": role,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and verify a JWT token."""
    if not _HAS_JWT:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


def generate_user_id() -> str:
    return str(uuid.uuid4())[:8]
