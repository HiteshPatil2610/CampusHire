from typing import Any, Optional
from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int
