import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, PyEnum):
    STUDENT = "STUDENT"
    DEPT_ADMIN = "DEPT_ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserStatus(str, PyEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"
    SUSPENDED = "SUSPENDED"


class RegistrationSource(str, PyEnum):
    SELF_REGISTERED = "SELF_REGISTERED"
    ADMIN_ADDED = "ADMIN_ADDED"
    EXCEL_IMPORT = "EXCEL_IMPORT"


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus), nullable=False, default=UserStatus.PENDING
    )
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    registration_source: Mapped[RegistrationSource] = mapped_column(
        Enum(RegistrationSource), nullable=False, default=RegistrationSource.SELF_REGISTERED
    )
    created_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    student_profile: Mapped["StudentProfile"] = relationship(
        "StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    admin_profile: Mapped["AdminProfile"] = relationship(
        "AdminProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    otp_verifications: Mapped[list["OTPVerification"]] = relationship(
        "OTPVerification", back_populates="user", cascade="all, delete-orphan"
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        "PasswordResetToken", back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan",
        foreign_keys="UserSession.user_id"
    )
