"""
Department admin + super-admin endpoints.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_dept_admin, require_super_admin
from app.models.user import User
from app.schemas.admin import (
    AddStudentRequest, AdminCreateRequest, AdminUpdateRequest,
    DepartmentCreate, DepartmentUpdate,
    DepartmentOut, DepartmentWithStats, AdminOut,
    ImportPreviewResponse, ImportConfirmResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Departments (super admin) ─────────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentWithStats])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(require_dept_admin),  # both admin roles can read
):
    return admin_service.list_departments(db)


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return admin_service.create_department(db, data, current_user.id)


@router.patch("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: str,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_service.update_department(db, dept_id, data)


@router.delete("/departments/{dept_id}", response_model=MessageResponse)
def delete_department(
    dept_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_service.delete_department(db, dept_id)


# ── Admin accounts (super admin) ──────────────────────────────────────────────

@router.get("/accounts", response_model=list[AdminOut])
def list_admins(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_service.list_admins(db)


@router.post("/accounts", response_model=dict, status_code=201)
def create_admin(
    data: AdminCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    return admin_service.create_admin(db, data, current_user.id)


@router.patch("/accounts/{admin_id}", response_model=MessageResponse)
def update_admin(
    admin_id: str,
    data: AdminUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_service.update_admin(db, admin_id, data)


@router.post("/accounts/{admin_id}/reset-password", response_model=MessageResponse)
def reset_admin_password(
    admin_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return admin_service.reset_admin_password(db, admin_id)


# ── Students (dept admin) ─────────────────────────────────────────────────────

@router.get("/students", response_model=PaginatedResponse)
def list_students(
    department_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_dept_admin),
):
    return admin_service.list_students(db, department_id, year, search, page, page_size)


@router.post("/students", response_model=dict, status_code=201)
def add_student(
    data: AddStudentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dept_admin),
):
    return admin_service.add_student(db, data, current_user.id)


# ── Excel import ──────────────────────────────────────────────────────────────

@router.post("/students/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_dept_admin),
):
    content = await file.read()
    return admin_service.preview_excel_import(db, content, file.filename or "upload.xlsx")


@router.post("/students/import/confirm", response_model=ImportConfirmResponse)
async def confirm_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dept_admin),
):
    content = await file.read()
    return admin_service.confirm_excel_import(db, content, file.filename or "upload.xlsx", current_user.id)
