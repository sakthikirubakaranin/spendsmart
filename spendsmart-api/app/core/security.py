import hashlib
import random
import string
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# ── Password ──────────────────────────────────────────────────────────────────
# bcrypt has a 72-byte hard limit. Pre-hashing with SHA-256 produces a
# 64-character hex string, well under the limit, while preserving full entropy.

def _pre_hash(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def hash_password(plain: str) -> str:
    return pwd_context.hash(_pre_hash(plain))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_pre_hash(plain), hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def _make_token(data: dict, expire_days: int) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=expire_days)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _make_token({"sub": user_id, "type": "access"}, settings.ACCESS_TOKEN_EXPIRE_DAYS)


def create_refresh_token(user_id: str) -> str:
    return _make_token({"sub": user_id, "type": "refresh"}, settings.REFRESH_TOKEN_EXPIRE_DAYS)


def decode_token(token: str) -> dict:
    """Raises JWTError on invalid / expired token."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_verification_token(length: int = 64) -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))
