"""
Student profile endpoints — all require STUDENT role.
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_student
from app.models.user import User
from app.schemas.student import (
    StudentProfileUpdate, StudentProfileOut,
    EducationCreate, EducationOut,
    AcademicRecordCreate, AcademicRecordOut,
    StudentSkillCreate, StudentSkillOut,
    ProjectCreate, ProjectOut,
    ExperienceCreate, ExperienceOut,
    CertificationCreate, CertificationOut,
    PreferencesUpdate, PreferencesOut,
    FullProfileOut,
)
from app.services import student_service

router = APIRouter(prefix="/student", tags=["Student"])


# ── Full profile ──────────────────────────────────────────────────────────────

@router.get("/profile", response_model=FullProfileOut)
def get_full_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.get_full_profile(db, current_user.id)


@router.patch("/profile", response_model=StudentProfileOut)
def update_profile(
    data: StudentProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.update_profile(db, current_user.id, data)


# ── Education ─────────────────────────────────────────────────────────────────

@router.put("/profile/education", response_model=List[EducationOut])
def upsert_education(
    items: List[EducationCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.upsert_education(db, current_user.id, items)


# ── Academic records ──────────────────────────────────────────────────────────

@router.put("/profile/academic-records", response_model=List[AcademicRecordOut])
def upsert_academic_records(
    items: List[AcademicRecordCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.upsert_academic_records(db, current_user.id, items)


# ── Skills ────────────────────────────────────────────────────────────────────

@router.put("/profile/skills", response_model=List[StudentSkillOut])
def sync_skills(
    items: List[StudentSkillCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.sync_skills(db, current_user.id, items)


# ── Projects ──────────────────────────────────────────────────────────────────

@router.put("/profile/projects", response_model=List[ProjectOut])
def sync_projects(
    items: List[ProjectCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.sync_projects(db, current_user.id, items)


# ── Experience ────────────────────────────────────────────────────────────────

@router.put("/profile/experience", response_model=List[ExperienceOut])
def sync_experiences(
    items: List[ExperienceCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.sync_experiences(db, current_user.id, items)


# ── Certifications ────────────────────────────────────────────────────────────

@router.put("/profile/certifications", response_model=List[CertificationOut])
def sync_certifications(
    items: List[CertificationCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.sync_certifications(db, current_user.id, items)


# ── Preferences ───────────────────────────────────────────────────────────────

@router.put("/profile/preferences", response_model=PreferencesOut)
def update_preferences(
    data: PreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    return student_service.update_preferences(db, current_user.id, data)
