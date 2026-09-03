from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator


# ── Register ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    roll_number: str
    phone_number: str
    department_id: str
    current_year: int
    current_semester: int
    gender: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("current_year")
    @classmethod
    def valid_year(cls, v: int) -> int:
        if v not in (1, 2, 3, 4):
            raise ValueError("Year must be 1–4")
        return v


class RegisterResponse(BaseModel):
    user_id: str
    message: str


# ── OTP ───────────────────────────────────────────────────────────────────────

class VerifyOTPRequest(BaseModel):
    user_id: str
    otp: str
    purpose: str = "REGISTRATION"


class ResendOTPRequest(BaseModel):
    user_id: str
    purpose: str = "REGISTRATION"


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Password reset ────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    user_id: str
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── User info ─────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    email: str
    role: str
    status: str
    email_verified: bool
    must_change_password: bool

    model_config = {"from_attributes": True}
