from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    role: str = Field(..., description="STUDENT or FACULTY")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True
