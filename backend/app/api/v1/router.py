from fastapi import APIRouter
from app.api.v1.endpoints import auth, student, admin

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(student.router)
api_router.include_router(admin.router)
