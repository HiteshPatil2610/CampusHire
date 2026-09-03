"""
Student profile business logic.
"""
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.student import (
    StudentProfile, StudentEducation, StudentAcademicRecord,
    Skill, StudentSkill, StudentProject, ProjectTechnology,
    StudentExperience, StudentCertification,
    StudentPreference, JobRole, StudentPreferredRole,
    Location, StudentPreferredLocation,
    SkillCategory,
)
from app.schemas.student import (
    StudentProfileUpdate, EducationCreate, AcademicRecordCreate,
    StudentSkillCreate, ProjectCreate, ExperienceCreate,
    CertificationCreate, PreferencesUpdate, FullProfileOut,
)


# ── Profile ───────────────────────────────────────────────────────────────────

def get_full_profile(db: Session, user_id: str) -> FullProfileOut:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return FullProfileOut(
        profile=profile,
        education=profile.education,
        academic_records=sorted(profile.academic_records, key=lambda r: r.semester),
        skills=[
            {"id": ss.id, "skill": ss.skill, "proficiency_level": ss.proficiency_level}
            for ss in profile.student_skills
        ],
        projects=[
            {
                "id": p.id, "title": p.title, "description": p.description,
                "project_link": p.project_link, "start_date": p.start_date,
                "end_date": p.end_date,
                "technologies": [pt.skill for pt in p.technologies],
            }
            for p in profile.projects
        ],
        experiences=profile.experiences,
        certifications=profile.certifications,
        preferences=_build_prefs_out(profile),
    )


def update_profile(db: Session, user_id: str, data: StudentProfileUpdate) -> StudentProfile:
    profile = _get_profile_or_404(db, user_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    _recalculate_completion(profile)
    db.commit()
    db.refresh(profile)
    return profile


# ── Education ─────────────────────────────────────────────────────────────────

def upsert_education(db: Session, user_id: str, items: list[EducationCreate]) -> list:
    profile = _get_profile_or_404(db, user_id)
    # Replace all education for this student
    db.query(StudentEducation).filter(
        StudentEducation.student_id == profile.id
    ).delete()
    records = []
    for item in items:
        rec = StudentEducation(student_id=profile.id, **item.model_dump())
        db.add(rec)
        records.append(rec)
    db.commit()
    return records


# ── Academic records ──────────────────────────────────────────────────────────

def upsert_academic_records(
    db: Session, user_id: str, items: list[AcademicRecordCreate]
) -> list:
    profile = _get_profile_or_404(db, user_id)
    db.query(StudentAcademicRecord).filter(
        StudentAcademicRecord.student_id == profile.id
    ).delete()
    records = []
    for item in items:
        rec = StudentAcademicRecord(student_id=profile.id, **item.model_dump())
        db.add(rec)
        records.append(rec)
    db.commit()
    return records


# ── Skills ────────────────────────────────────────────────────────────────────

def sync_skills(db: Session, user_id: str, items: list[StudentSkillCreate]) -> list:
    profile = _get_profile_or_404(db, user_id)
    db.query(StudentSkill).filter(StudentSkill.student_id == profile.id).delete()
    result = []
    for item in items:
        skill = _get_or_create_skill(db, item.skill_name, item.category)
        ss = StudentSkill(
            student_id=profile.id,
            skill_id=skill.id,
            proficiency_level=item.proficiency_level,
        )
        db.add(ss)
        result.append(ss)
    _recalculate_completion(profile)
    db.commit()
    return result


def _get_or_create_skill(db: Session, name: str, category: str = "TECHNICAL") -> Skill:
    skill = db.query(Skill).filter(Skill.name == name).first()
    if not skill:
        skill = Skill(name=name, category=SkillCategory(category))
        db.add(skill)
        db.flush()
    return skill


# ── Projects ──────────────────────────────────────────────────────────────────

def sync_projects(db: Session, user_id: str, items: list[ProjectCreate]) -> list:
    profile = _get_profile_or_404(db, user_id)
    db.query(StudentProject).filter(StudentProject.student_id == profile.id).delete()
    result = []
    for item in items:
        techs = item.technologies or []
        proj = StudentProject(
            student_id=profile.id,
            title=item.title,
            description=item.description,
            project_link=item.project_link,
            start_date=item.start_date,
            end_date=item.end_date,
        )
        db.add(proj)
        db.flush()
        for tech_name in techs:
            skill = _get_or_create_skill(db, tech_name)
            db.add(ProjectTechnology(project_id=proj.id, skill_id=skill.id))
        result.append(proj)
    _recalculate_completion(profile)
    db.commit()
    return result


# ── Experience ────────────────────────────────────────────────────────────────

def sync_experiences(db: Session, user_id: str, items: list[ExperienceCreate]) -> list:
    profile = _get_profile_or_404(db, user_id)
    db.query(StudentExperience).filter(StudentExperience.student_id == profile.id).delete()
    result = []
    for item in items:
        exp = StudentExperience(student_id=profile.id, **item.model_dump())
        db.add(exp)
        result.append(exp)
    _recalculate_completion(profile)
    db.commit()
    return result


# ── Certifications ────────────────────────────────────────────────────────────

def sync_certifications(db: Session, user_id: str, items: list[CertificationCreate]) -> list:
    profile = _get_profile_or_404(db, user_id)
    db.query(StudentCertification).filter(
        StudentCertification.student_id == profile.id
    ).delete()
    result = []
    for item in items:
        cert = StudentCertification(student_id=profile.id, **item.model_dump())
        db.add(cert)
        result.append(cert)
    _recalculate_completion(profile)
    db.commit()
    return result


# ── Preferences ───────────────────────────────────────────────────────────────

def update_preferences(db: Session, user_id: str, data: PreferencesUpdate) -> dict:
    profile = _get_profile_or_404(db, user_id)

    prefs = db.query(StudentPreference).filter(
        StudentPreference.student_id == profile.id
    ).first()
    if not prefs:
        prefs = StudentPreference(student_id=profile.id)
        db.add(prefs)
        db.flush()

    if data.preferred_company_type is not None:
        prefs.preferred_company_type = data.preferred_company_type
    if data.expected_package is not None:
        prefs.expected_package = data.expected_package
    if data.willing_to_relocate is not None:
        prefs.willing_to_relocate = data.willing_to_relocate

    # Sync preferred roles
    if data.preferred_roles is not None:
        db.query(StudentPreferredRole).filter(
            StudentPreferredRole.student_id == profile.id
        ).delete()
        for role_name in data.preferred_roles:
            jr = db.query(JobRole).filter(JobRole.name == role_name).first()
            if not jr:
                jr = JobRole(name=role_name)
                db.add(jr)
                db.flush()
            db.add(StudentPreferredRole(student_id=profile.id, job_role_id=jr.id))

    # Sync preferred locations
    if data.preferred_locations is not None:
        db.query(StudentPreferredLocation).filter(
            StudentPreferredLocation.student_id == profile.id
        ).delete()
        for city_name in data.preferred_locations:
            loc = db.query(Location).filter(Location.city == city_name).first()
            if not loc:
                loc = Location(city=city_name)
                db.add(loc)
                db.flush()
            db.add(StudentPreferredLocation(student_id=profile.id, location_id=loc.id))

    db.commit()
    return _build_prefs_out(profile)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_profile_or_404(db: Session, user_id: str) -> StudentProfile:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


def _build_prefs_out(profile: StudentProfile) -> Optional[dict]:
    if not profile.preferences:
        return None
    return {
        "preferred_company_type": profile.preferences.preferred_company_type,
        "expected_package": float(profile.preferences.expected_package)
            if profile.preferences.expected_package else None,
        "willing_to_relocate": profile.preferences.willing_to_relocate,
        "preferred_roles": [spr.job_role.name for spr in profile.preferred_roles],
        "preferred_locations": [spl.location.city for spl in profile.preferred_locations],
    }


def _recalculate_completion(profile: StudentProfile) -> None:
    """Simple scoring: each section filled = points."""
    score = 0
    total = 7

    if profile.full_name and profile.phone_number and profile.date_of_birth:
        score += 1
    if profile.education:
        score += 1
    if profile.academic_records:
        score += 1
    if profile.student_skills:
        score += 1
    if profile.projects:
        score += 1
    if profile.experiences or profile.certifications:
        score += 1
    if profile.preferences:
        score += 1

    profile.profile_completion_percentage = round((score / total) * 100, 2)
