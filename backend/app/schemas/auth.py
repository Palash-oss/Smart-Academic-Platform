from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    role: str = Field(..., description="STUDENT, FACULTY, or ADMIN")
    # Optional: student ERP ID and roll number for allotment matching
    student_erp_id: Optional[str] = Field(None, description="e.g. 'ST2024001'")
    roll_no: Optional[str] = Field(None, description="e.g. '24CE101'")


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
    student_erp_id: Optional[str] = None
    roll_no: Optional[str] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    student_erp_id: Optional[str] = None
    roll_no: Optional[str] = None

    model_config = {"from_attributes": True}
