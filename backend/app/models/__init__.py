# Import all models so Alembic can detect them
from app.models.user import User, UserRole, UserStatus, RegistrationSource  # noqa
from app.models.auth import OTPVerification, PasswordResetToken, UserSession  # noqa
from app.models.department import Department, AdminProfile, AdminDepartmentMapping  # noqa
from app.models.student import (  # noqa
    StudentProfile, StudentEducation, StudentAcademicRecord,
    Skill, StudentSkill,
    StudentProject, ProjectTechnology,
    StudentExperience, StudentCertification,
    StudentPreference, JobRole, StudentPreferredRole,
    Location, StudentPreferredLocation,
)
