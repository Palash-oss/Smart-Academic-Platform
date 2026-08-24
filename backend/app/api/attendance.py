from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import csv
import io
from typing import List, Dict, Any, Optional

from app.db.session import get_db
from app.db.models import User
from app.api.auth import get_current_user, require_role
from app.schemas.attendance import MarkAttendanceRequest
from app.services.attendance_service import (
    fetch_student_attendance_records,
    fetch_all_students_faculty_overview,
    fetch_faculty_departments_and_divisions,
    fetch_courses_by_department,
    fetch_students_by_division,
    mark_session_attendance,
    bulk_import_roster
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/my")
async def get_my_attendance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch attendance summary and per-subject risk calculation for current authenticated student."""
    return await fetch_student_attendance_records(db, current_user.id)


@router.get("/students/{student_id}")
async def get_student_attendance_by_id(
    student_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch attendance details for a specific student ID."""
    if current_user.role == "STUDENT" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own attendance data."
        )
    return await fetch_student_attendance_records(db, student_id)


@router.get("/faculty/overview")
async def get_faculty_attendance_overview(
    dept_code: Optional[str] = Query(None),
    div_name: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Faculty Dashboard endpoint: Returns attendance breakdown and risk status for enrolled students."""
    return await fetch_all_students_faculty_overview(db, dept_code=dept_code, div_name=div_name)


@router.get("/faculty/departments")
async def get_faculty_departments(
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns list of departments and divisions for dropdown filtering."""
    return await fetch_faculty_departments_and_divisions(db)


@router.get("/faculty/courses")
async def get_faculty_courses(
    dept_code: str = Query(...),
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns department-scoped courses for lecture session selection."""
    return await fetch_courses_by_department(db, dept_code)


@router.get("/faculty/students")
async def get_faculty_division_students(
    dept_code: str = Query(...),
    div_name: str = Query(...),
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns student roster for a specific Department + Division (e.g. COMP-A, COMP-B)."""
    return await fetch_students_by_division(db, dept_code, div_name)


@router.post("/faculty/mark")
async def mark_attendance_endpoint(
    req: MarkAttendanceRequest,
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Live Attendance Marking endpoint for Faculty.
    Increments total_classes for all enrolled students, and attended_classes for present students.
    """
    if not req.all_enrolled_student_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enrolled student IDs list cannot be empty."
        )

    return await mark_session_attendance(
        db=db,
        subject=req.subject,
        present_student_ids=req.present_student_ids,
        all_enrolled_student_ids=req.all_enrolled_student_ids
    )


@router.post("/faculty/roster/import")
async def import_roster_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Bulk Import endpoint accepting CSV upload (name,email)."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file with format name,email"
        )

    content = await file.read()
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    students_data = []
    for row in reader:
        name = row.get("name") or row.get("Name") or row.get("full_name") or ""
        email = row.get("email") or row.get("Email") or ""
        if name and email:
            students_data.append({"name": name.strip(), "email": email.strip()})

    if not students_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no valid student rows with name and email headers."
        )

    return await bulk_import_roster(db, students_data)
