from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr


# ── Department ────────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    department_name: str
    department_code: str
    status: bool = True


class DepartmentUpdate(BaseModel):
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    status: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: str
    department_name: str
    department_code: str
    status: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class DepartmentWithStats(DepartmentOut):
    student_count: int = 0
    admin_count: int = 0


# ── Admin account ─────────────────────────────────────────────────────────────

class AdminCreateRequest(BaseModel):
    email: EmailStr
    full_name: str
    phone_number: Optional[str] = None
    role: str = "DEPT_ADMIN"   # DEPT_ADMIN | SUPER_ADMIN
    department_ids: List[str] = []


class AdminUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[str] = None
    department_ids: Optional[List[str]] = None


class AdminOut(BaseModel):
    id: str                   # user id
    email: str
    role: str
    status: str
    full_name: str
    phone_number: Optional[str] = None
    departments: List[DepartmentOut] = []
    last_login_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Student list (admin view) ─────────────────────────────────────────────────

class StudentListItem(BaseModel):
    user_id: str
    profile_id: str
    full_name: str
    roll_number: str
    email: str
    department_name: str
    department_code: str
    current_year: int
    current_semester: int
    profile_completion_percentage: float
    status: str
    model_config = {"from_attributes": True}


# ── Add student (admin) ───────────────────────────────────────────────────────

class AddStudentRequest(BaseModel):
    email: EmailStr
    full_name: str
    roll_number: str
    phone_number: Optional[str] = None
    department_id: str
    current_year: int
    current_semester: int = 1


# ── Excel import ──────────────────────────────────────────────────────────────

class ImportRowResult(BaseModel):
    row_number: int
    email: Optional[str] = None
    roll_number: Optional[str] = None
    status: str   # valid | error
    error_message: Optional[str] = None


class ImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    preview: List[ImportRowResult]


class ImportConfirmResponse(BaseModel):
    imported_count: int
    failed_count: int
    message: str
