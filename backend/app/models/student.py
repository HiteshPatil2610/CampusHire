import uuid
from datetime import date, datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (Boolean, Date, DateTime, Enum, ForeignKey,
                        Integer, Numeric, String, Text)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(timezone.utc)


class EducationLevel(str, PyEnum):
    TENTH = "10TH"
    TWELFTH = "12TH"
    DIPLOMA = "DIPLOMA"


class SkillCategory(str, PyEnum):
    TECHNICAL = "TECHNICAL"
    SOFT = "SOFT"
    LANGUAGE = "LANGUAGE"
    TOOL = "TOOL"


class ProficiencyLevel(str, PyEnum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    EXPERT = "EXPERT"


class CompanyType(str, PyEnum):
    PRODUCT = "PRODUCT"
    SERVICE = "SERVICE"
    STARTUP = "STARTUP"
    NO_PREFERENCE = "NO_PREFERENCE"


# ── Student Profile ───────────────────────────────────────────────────────────

class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    roll_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("departments.id"), nullable=False
    )
    current_year: Mapped[int] = mapped_column(Integer, nullable=False)
    current_semester: Mapped[int] = mapped_column(Integer, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    alternate_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_completion_percentage: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    import_job_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    # Relationships
    user = relationship("User", back_populates="student_profile")
    department = relationship("Department", back_populates="student_profiles")
    education: Mapped[list["StudentEducation"]] = relationship(
        "StudentEducation", back_populates="student", cascade="all, delete-orphan"
    )
    academic_records: Mapped[list["StudentAcademicRecord"]] = relationship(
        "StudentAcademicRecord", back_populates="student", cascade="all, delete-orphan"
    )
    student_skills: Mapped[list["StudentSkill"]] = relationship(
        "StudentSkill", back_populates="student", cascade="all, delete-orphan"
    )
    projects: Mapped[list["StudentProject"]] = relationship(
        "StudentProject", back_populates="student", cascade="all, delete-orphan"
    )
    experiences: Mapped[list["StudentExperience"]] = relationship(
        "StudentExperience", back_populates="student", cascade="all, delete-orphan"
    )
    certifications: Mapped[list["StudentCertification"]] = relationship(
        "StudentCertification", back_populates="student", cascade="all, delete-orphan"
    )
    preferences: Mapped["StudentPreference"] = relationship(
        "StudentPreference", back_populates="student", uselist=False,
        cascade="all, delete-orphan"
    )
    preferred_roles: Mapped[list["StudentPreferredRole"]] = relationship(
        "StudentPreferredRole", back_populates="student", cascade="all, delete-orphan"
    )
    preferred_locations: Mapped[list["StudentPreferredLocation"]] = relationship(
        "StudentPreferredLocation", back_populates="student", cascade="all, delete-orphan"
    )


# ── Education ─────────────────────────────────────────────────────────────────

class StudentEducation(Base):
    __tablename__ = "student_education"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    education_level: Mapped[EducationLevel] = mapped_column(Enum(EducationLevel))
    percentage: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    cgpa: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    board: Mapped[str | None] = mapped_column(String(100), nullable=True)
    passing_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    student = relationship("StudentProfile", back_populates="education")


# ── Academic Records (per-semester CGPA) ─────────────────────────────────────

class StudentAcademicRecord(Base):
    __tablename__ = "student_academic_records"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    cgpa: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    active_backlogs: Mapped[int] = mapped_column(Integer, default=0)
    total_backlogs_cleared: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    student = relationship("StudentProfile", back_populates="academic_records")


# ── Skills ────────────────────────────────────────────────────────────────────

class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[SkillCategory] = mapped_column(Enum(SkillCategory),
                                                      default=SkillCategory.TECHNICAL)
    status: Mapped[bool] = mapped_column(Boolean, default=True)

    student_skills: Mapped[list["StudentSkill"]] = relationship("StudentSkill", back_populates="skill")
    project_technologies: Mapped[list["ProjectTechnology"]] = relationship(
        "ProjectTechnology", back_populates="skill"
    )


class StudentSkill(Base):
    __tablename__ = "student_skills"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    skill_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("skills.id", ondelete="CASCADE")
    )
    proficiency_level: Mapped[ProficiencyLevel | None] = mapped_column(
        Enum(ProficiencyLevel), nullable=True
    )

    student = relationship("StudentProfile", back_populates="student_skills")
    skill = relationship("Skill", back_populates="student_skills")


# ── Projects ──────────────────────────────────────────────────────────────────

class StudentProject(Base):
    __tablename__ = "student_projects"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    student = relationship("StudentProfile", back_populates="projects")
    technologies: Mapped[list["ProjectTechnology"]] = relationship(
        "ProjectTechnology", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectTechnology(Base):
    __tablename__ = "project_technologies"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_projects.id", ondelete="CASCADE")
    )
    skill_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("skills.id", ondelete="CASCADE")
    )

    project = relationship("StudentProject", back_populates="technologies")
    skill = relationship("Skill", back_populates="project_technologies")


# ── Experience ────────────────────────────────────────────────────────────────

class StudentExperience(Base):
    __tablename__ = "student_experiences"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role_title: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    currently_working: Mapped[bool] = mapped_column(Boolean, default=False)

    student = relationship("StudentProfile", back_populates="experiences")


# ── Certifications ────────────────────────────────────────────────────────────

class StudentCertification(Base):
    __tablename__ = "student_certifications"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    issuing_organization: Mapped[str | None] = mapped_column(String(200), nullable=True)
    date_issued: Mapped[date | None] = mapped_column(Date, nullable=True)
    credential_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    certificate_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    student = relationship("StudentProfile", back_populates="certifications")


# ── Preferences ───────────────────────────────────────────────────────────────

class StudentPreference(Base):
    __tablename__ = "student_preferences"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE"),
        unique=True
    )
    preferred_company_type: Mapped[CompanyType] = mapped_column(
        Enum(CompanyType), default=CompanyType.NO_PREFERENCE
    )
    expected_package: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    willing_to_relocate: Mapped[bool] = mapped_column(Boolean, default=True)

    student = relationship("StudentProfile", back_populates="preferences")


class JobRole(Base):
    __tablename__ = "job_roles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[bool] = mapped_column(Boolean, default=True)

    student_preferred_roles: Mapped[list["StudentPreferredRole"]] = relationship(
        "StudentPreferredRole", back_populates="job_role"
    )


class StudentPreferredRole(Base):
    __tablename__ = "student_preferred_roles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    job_role_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("job_roles.id", ondelete="CASCADE")
    )

    student = relationship("StudentProfile", back_populates="preferred_roles")
    job_role = relationship("JobRole", back_populates="student_preferred_roles")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(100), default="India")

    student_preferred_locations: Mapped[list["StudentPreferredLocation"]] = relationship(
        "StudentPreferredLocation", back_populates="location"
    )


class StudentPreferredLocation(Base):
    __tablename__ = "student_preferred_locations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True,
                                    default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("student_profiles.id", ondelete="CASCADE")
    )
    location_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("locations.id", ondelete="CASCADE")
    )

    student = relationship("StudentProfile", back_populates="preferred_locations")
    location = relationship("Location", back_populates="student_preferred_locations")
