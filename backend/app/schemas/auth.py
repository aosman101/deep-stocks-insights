"""Schemas for authentication endpoints."""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    email: str
    role: str


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str | None = None
    institution: str | None = None
