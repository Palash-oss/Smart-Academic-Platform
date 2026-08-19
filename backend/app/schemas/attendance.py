from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uuid


class AttendanceRecord(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    subject: str
    total_classes: int
    attended_classes: int
    percentage: float
    is_at_risk: bool

    class Config:
        from_attributes = True


class StudentAttendanceSummary(BaseModel):
    student_id: uuid.UUID
    student_name: str
    overall_percentage: float
    overall_risk: bool
    subject_records: List[AttendanceRecord]


class FacultyStudentOverview(BaseModel):
    student_id: uuid.UUID
    student_name: str
    student_email: str
    overall_percentage: float
    overall_risk: bool
    total_subjects: int
    subjects_at_risk: int


class MarkAttendanceRequest(BaseModel):
    subject: str
    session_date: str = "2026-08-19"
    present_student_ids: List[uuid.UUID]
    all_enrolled_student_ids: List[uuid.UUID]


class RosterStudentRow(BaseModel):
    name: str
    email: EmailStr
