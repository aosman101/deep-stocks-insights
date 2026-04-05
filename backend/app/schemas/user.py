"""Schemas for user management endpoints."""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    institution: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    institution: Optional[str] = None
    bio: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    total: int
    users: list[UserResponse]


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    institution: Optional[str] = None
    bio: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
