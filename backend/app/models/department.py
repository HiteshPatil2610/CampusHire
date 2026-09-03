import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(timezone.utc)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    department_name: Mapped[str] = mapped_column(String(100), nullable=False)
    department_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    status: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    # Relationships
    student_profiles: Mapped[list["StudentProfile"]] = relationship(
        "StudentProfile", back_populates="department"
    )
    admin_mappings: Mapped[list["AdminDepartmentMapping"]] = relationship(
        "AdminDepartmentMapping", back_populates="department", cascade="all, delete-orphan"
    )


class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    user = relationship("User", back_populates="admin_profile")
    department_mappings: Mapped[list["AdminDepartmentMapping"]] = relationship(
        "AdminDepartmentMapping", back_populates="admin",
        foreign_keys="AdminDepartmentMapping.admin_user_id"
    )


class AdminDepartmentMapping(Base):
    __tablename__ = "admin_department_mapping"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    admin_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    assigned_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=True
    )

    admin = relationship("AdminProfile", back_populates="department_mappings",
                         foreign_keys=[admin_user_id])
    department = relationship("Department", back_populates="admin_mappings")
