from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, RegisterResponse,
    VerifyOTPRequest, ResendOTPRequest,
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, UserOut,
)
from app.schemas.common import MessageResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return auth_service.register_student(db, data)


@router.post("/verify-otp", response_model=MessageResponse)
def verify_otp(data: VerifyOTPRequest, db: Session = Depends(get_db)):
    return auth_service.verify_otp(db, data.user_id, data.otp, data.purpose)


@router.post("/resend-otp", response_model=MessageResponse)
def resend_otp(data: ResendOTPRequest, db: Session = Depends(get_db)):
    return auth_service.resend_otp(db, data.user_id, data.purpose)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    device = request.headers.get("user-agent", "unknown")
    return auth_service.login(db, data, ip, device)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.refresh_tokens(db, data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.logout(db, data.refresh_token)


@router.post("/forgot-password", response_model=dict)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return auth_service.forgot_password(db, data.email)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    return auth_service.reset_password(db, data.user_id, data.otp, data.new_password)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return auth_service.change_password(db, current_user, data.current_password, data.new_password)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
