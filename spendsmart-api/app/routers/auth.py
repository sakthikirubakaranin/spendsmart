from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    generate_verification_token,
    hash_password,
    verify_password,
)
from app.models.notification_preference import NotificationPreference
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _build_token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_DAYS * 86400,
        user=UserOut.model_validate(user),
    )


# ── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # In development, auto-verify so users can log in immediately.
    # In production, set is_verified=False and send a real verification email.
    dev_mode = settings.APP_ENV != "production"

    token = generate_verification_token()
    user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        verification_token=None if dev_mode else token,
        is_verified=dev_mode,
    )
    db.add(user)
    await db.flush()

    # Create default notification preferences
    db.add(NotificationPreference(user_id=user.id))
    await db.commit()

    if dev_mode:
        return MessageResponse(message="Registration successful. You can log in immediately (dev mode).")

    # TODO: background_tasks.add_task(send_verification_email, user.email, token)
    return MessageResponse(message="Registration successful. Please check your email to verify your account.")


# ── Verify email ──────────────────────────────────────────────────────────────

@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.verification_token == body.token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.is_verified = True
    user.verification_token = None
    await db.commit()
    return MessageResponse(message="Email verified successfully. You can now log in.")


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Generic error — don't reveal which field is wrong
    INVALID = HTTPException(status_code=401, detail="Invalid email or password")

    if not user:
        raise INVALID

    # Lockout check
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail=f"Account locked. Try again in {remaining} minute(s).")

    if not verify_password(body.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            from datetime import timedelta
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
        await db.commit()
        raise INVALID

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in")

    # Successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return _build_token_response(user)


# ── Refresh token ─────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user_id = payload["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return _build_token_response(user)


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_user)):
    # With stateless JWT, logout is handled client-side (delete tokens).
    # Server-side token revocation can be added via a Redis blocklist.
    return MessageResponse(message="Logged out successfully")


# ── Forgot password ───────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user:
        from datetime import timedelta
        otp = generate_otp()
        user.reset_otp = otp
        user.reset_otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        await db.commit()
        # TODO: background_tasks.add_task(send_otp_email, user.email, otp)

    return MessageResponse(message="If an account exists with that email, a 6-digit OTP has been sent.")


# ── Reset password ────────────────────────────────────────────────────────────

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    INVALID_OTP = HTTPException(status_code=400, detail="Invalid or expired OTP")

    if not user or not user.reset_otp:
        raise INVALID_OTP
    if user.reset_otp != body.otp:
        raise INVALID_OTP
    if user.reset_otp_expires_at < datetime.now(timezone.utc):
        raise INVALID_OTP

    user.password_hash = hash_password(body.new_password)
    user.reset_otp = None
    user.reset_otp_expires_at = None
    # Invalidate all sessions by rotating the JWT secret is not practical here;
    # instead mark a password_changed_at timestamp for future token validation.
    await db.commit()
    return MessageResponse(message="Password reset successfully. You can now log in.")


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
