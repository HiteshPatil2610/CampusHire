from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr


# ── Student Profile ───────────────────────────────────────────────────────────

class StudentProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    alternate_email: Optional[EmailStr] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    current_year: Optional[int] = None
    current_semester: Optional[int] = None


class StudentProfileOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    roll_number: str
    department_id: str
    current_year: int
    current_semester: int
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    alternate_email: Optional[str] = None
    address: Optional[str] = None
    profile_photo_url: Optional[str] = None
    profile_completion_percentage: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Education ─────────────────────────────────────────────────────────────────

class EducationCreate(BaseModel):
    education_level: str  # 10TH | 12TH | DIPLOMA
    percentage: Optional[float] = None
    cgpa: Optional[float] = None
    board: Optional[str] = None
    passing_year: Optional[int] = None


class EducationOut(EducationCreate):
    id: str
    student_id: str
    model_config = {"from_attributes": True}


# ── Academic Records ──────────────────────────────────────────────────────────

class AcademicRecordCreate(BaseModel):
    semester: int
    cgpa: Optional[float] = None
    active_backlogs: int = 0
    total_backlogs_cleared: int = 0


class AcademicRecordOut(AcademicRecordCreate):
    id: str
    student_id: str
    model_config = {"from_attributes": True}


# ── Skills ────────────────────────────────────────────────────────────────────

class SkillCreate(BaseModel):
    name: str
    category: str = "TECHNICAL"


class SkillOut(BaseModel):
    id: str
    name: str
    category: str
    model_config = {"from_attributes": True}


class StudentSkillCreate(BaseModel):
    skill_name: str          # auto-creates skill if not exists
    category: str = "TECHNICAL"
    proficiency_level: Optional[str] = None


class StudentSkillOut(BaseModel):
    id: str
    skill: SkillOut
    proficiency_level: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_link: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    technologies: List[str] = []   # list of skill names


class ProjectOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    project_link: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    technologies: List[SkillOut] = []
    model_config = {"from_attributes": True}


# ── Experience ────────────────────────────────────────────────────────────────

class ExperienceCreate(BaseModel):
    company_name: str
    role_title: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None
    currently_working: bool = False


class ExperienceOut(ExperienceCreate):
    id: str
    student_id: str
    model_config = {"from_attributes": True}


# ── Certifications ────────────────────────────────────────────────────────────

class CertificationCreate(BaseModel):
    title: str
    issuing_organization: Optional[str] = None
    date_issued: Optional[date] = None
    credential_url: Optional[str] = None


class CertificationOut(CertificationCreate):
    id: str
    student_id: str
    model_config = {"from_attributes": True}


# ── Preferences ───────────────────────────────────────────────────────────────

class PreferencesUpdate(BaseModel):
    preferred_company_type: Optional[str] = None
    expected_package: Optional[float] = None
    willing_to_relocate: Optional[bool] = None
    preferred_roles: Optional[List[str]] = None      # job role names
    preferred_locations: Optional[List[str]] = None  # city names


class PreferencesOut(BaseModel):
    preferred_company_type: str
    expected_package: Optional[float] = None
    willing_to_relocate: bool
    preferred_roles: List[str] = []
    preferred_locations: List[str] = []
    model_config = {"from_attributes": True}


# ── Full profile (combined) ───────────────────────────────────────────────────

class FullProfileOut(BaseModel):
    profile: StudentProfileOut
    education: List[EducationOut] = []
    academic_records: List[AcademicRecordOut] = []
    skills: List[StudentSkillOut] = []
    projects: List[ProjectOut] = []
    experiences: List[ExperienceOut] = []
    certifications: List[CertificationOut] = []
    preferences: Optional[PreferencesOut] = None
