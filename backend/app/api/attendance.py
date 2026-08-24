from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import csv
import io
from datetime import date
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
    fetch_marked_sessions_for_date,
    undo_lecture_session,
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
    """Faculty Dashboard endpoint: Returns attendance breakdown scoped to Faculty's Department."""
    return await fetch_all_students_faculty_overview(
        db,
        faculty_dept_id=current_user.department_id,
        dept_code=dept_code,
        div_name=div_name
    )


@router.get("/faculty/departments")
async def get_faculty_departments(
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns list of departments and divisions available for current faculty."""
    return await fetch_faculty_departments_and_divisions(
        db,
        faculty_dept_id=current_user.department_id
    )


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


@router.get("/faculty/sessions")
async def get_faculty_marked_sessions(
    subject: str = Query(...),
    session_date: str = Query(...),
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Fetches marked lecture sessions for a given date and subject to display session history & enable Undo."""
    return await fetch_marked_sessions_for_date(
        db=db,
        faculty_id=current_user.id,
        subject=subject,
        session_date=session_date
    )


@router.post("/faculty/mark")
async def mark_attendance_endpoint(
    req: MarkAttendanceRequest,
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Live Attendance Marking endpoint for Faculty (Strict Daily Cap: Max 2 lectures per day per subject)."""
    if not req.all_enrolled_student_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enrolled student IDs list cannot be empty."
        )

    sess_date = req.session_date if req.session_date else date.today().strftime("%Y-%m-%d")

    try:
        return await mark_session_attendance(
            db=db,
            faculty_id=current_user.id,
            subject=req.subject,
            session_date=sess_date,
            present_student_ids=req.present_student_ids,
            all_enrolled_student_ids=req.all_enrolled_student_ids
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )


@router.post("/faculty/sessions/{session_id}/undo")
async def undo_attendance_session_endpoint(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role(["FACULTY"])),
    db: AsyncSession = Depends(get_db)
):
    """Reverts (undoes) a previously submitted lecture session, decrementing total & attended classes."""
    try:
        return await undo_lecture_session(
            db=db,
            session_id=session_id,
            faculty_id=current_user.id
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
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
