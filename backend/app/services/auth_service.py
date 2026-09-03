"""
Auth business logic — registration, OTP, login, token refresh, password reset.
All DB mutations happen here; endpoints stay thin.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_otp_email, send_credentials_email
from app.core.security import (
    create_access_token, create_refresh_token, hash_password,
    hash_token, verify_password, generate_otp, hash_otp,
    verify_otp_hash, generate_temp_password,
)
from app.models.auth import OTPVerification, OTPPurpose, PasswordResetToken, UserSession
from app.models.department import AdminProfile, AdminDepartmentMapping
from app.models.student import StudentProfile
from app.models.user import User, UserRole, UserStatus, RegistrationSource
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Registration ──────────────────────────────────────────────────────────────

def register_student(db: Session, data: RegisterRequest) -> dict:
    # Check duplicate email
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check duplicate roll number
    if db.query(StudentProfile).filter(StudentProfile.roll_number == data.roll_number).first():
        raise HTTPException(status_code=400, detail="Roll number already exists")

    # Validate department exists
    from app.models.department import Department
    dept = db.query(Department).filter(Department.id == data.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Department not found")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=UserRole.STUDENT,
        status=UserStatus.PENDING,
        email_verified=False,
        registration_source=RegistrationSource.SELF_REGISTERED,
    )
    db.add(user)
    db.flush()  # get user.id

    profile = StudentProfile(
        user_id=user.id,
        full_name=data.full_name,
        roll_number=data.roll_number,
        department_id=data.department_id,
        current_year=data.current_year,
        current_semester=data.current_semester,
        phone_number=data.phone_number,
        gender=data.gender,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    # Send OTP
    _create_and_send_otp(db, user, OTPPurpose.REGISTRATION)

    return {"user_id": user.id, "message": "OTP sent to your email. Please verify to activate account."}


# ── OTP ───────────────────────────────────────────────────────────────────────

def _create_and_send_otp(db: Session, user: User, purpose: OTPPurpose) -> None:
    # Invalidate old OTPs for same purpose
    db.query(OTPVerification).filter(
        OTPVerification.user_id == user.id,
        OTPVerification.purpose == purpose,
        OTPVerification.verified_at.is_(None),
    ).delete()

    otp = generate_otp()
    expires = _now() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    record = OTPVerification(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        purpose=purpose,
        expires_at=expires,
    )
    db.add(record)
    db.commit()

    send_otp_email(user.email, otp, purpose.value)


def verify_otp(db: Session, user_id: str, otp: str, purpose: str) -> dict:
    user = _get_user_or_404(db, user_id)

    record = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.user_id == user_id,
            OTPVerification.purpose == purpose,
            OTPVerification.verified_at.is_(None),
        )
        .order_by(OTPVerification.created_at.desc())
        .first()
    )

    if not record:
        raise HTTPException(status_code=400, detail="No pending OTP found")

    if _now() > record.expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired")

    record.attempts += 1
    if record.attempts > settings.OTP_MAX_ATTEMPTS:
        db.commit()
        raise HTTPException(status_code=400, detail="Too many attempts. Request a new OTP.")

    if not verify_otp_hash(otp, record.otp_hash):
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")

    record.verified_at = _now()

    if purpose == OTPPurpose.REGISTRATION.value:
        user.email_verified = True
        user.status = UserStatus.ACTIVE

    db.commit()
    return {"message": "OTP verified successfully"}


def resend_otp(db: Session, user_id: str, purpose: str) -> dict:
    user = _get_user_or_404(db, user_id)
    _create_and_send_otp(db, user, OTPPurpose(purpose))
    return {"message": "OTP resent"}


# ── Login / tokens ────────────────────────────────────────────────────────────

def login(db: Session, data: LoginRequest, ip: str, device_info: str) -> TokenResponse:
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.status == UserStatus.PENDING:
        raise HTTPException(status_code=403, detail="Please verify your email first")

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Account is not active")

    # Update last login
    user.last_login_at = _now()
    db.commit()

    access = create_access_token(user.id, user.role.value)
    refresh = create_refresh_token(user.id)

    # Store refresh token
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh),
        ip_address=ip,
        device_info=device_info,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        role=user.role.value,
        user_id=user.id,
        must_change_password=user.must_change_password,
    )


def refresh_tokens(db: Session, refresh_token: str) -> TokenResponse:
    from app.core.security import decode_token
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    token_hash = hash_token(refresh_token)

    session = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.refresh_token_hash == token_hash,
        UserSession.revoked_at.is_(None),
    ).first()

    if not session or _now() > session.expires_at:
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    # Rotate token
    session.revoked_at = _now()
    user = _get_user_or_404(db, user_id)

    new_access = create_access_token(user.id, user.role.value)
    new_refresh = create_refresh_token(user.id)

    new_session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(new_refresh),
        ip_address=session.ip_address,
        device_info=session.device_info,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_session)
    db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        role=user.role.value,
        user_id=user.id,
    )


def logout(db: Session, refresh_token: str) -> dict:
    token_hash = hash_token(refresh_token)
    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == token_hash,
        UserSession.revoked_at.is_(None),
    ).first()
    if session:
        session.revoked_at = _now()
        db.commit()
    return {"message": "Logged out"}


# ── Password ──────────────────────────────────────────────────────────────────

def forgot_password(db: Session, email: str) -> dict:
    user = db.query(User).filter(User.email == email).first()
    if user and user.status == UserStatus.ACTIVE:
        _create_and_send_otp(db, user, OTPPurpose.PASSWORD_RESET)
        return {"user_id": user.id, "message": "OTP sent if email is registered"}
    # Always return same message to prevent email enumeration
    return {"user_id": "", "message": "OTP sent if email is registered"}


def reset_password(db: Session, user_id: str, otp: str, new_password: str) -> dict:
    verify_otp(db, user_id, otp, OTPPurpose.PASSWORD_RESET.value)
    user = _get_user_or_404(db, user_id)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    db.commit()
    return {"message": "Password reset successfully"}


def change_password(db: Session, user: User, current: str, new: str) -> dict:
    if not verify_password(current, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(new)
    user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_user_or_404(db: Session, user_id: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
