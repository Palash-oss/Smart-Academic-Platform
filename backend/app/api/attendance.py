from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import csv
import io
from datetime import date
from typing import List, Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.db.models import User, AttendanceCondonation, AttendanceLog
from app.api.auth import get_current_user, require_role
from app.schemas.attendance import (
    MarkAttendanceRequest,
    CreateCondonationRequest,
    CondonationResponse,
)
from app.services.attendance_service import (
    fetch_student_attendance_records,
    fetch_all_students_faculty_overview,
    fetch_faculty_departments_and_divisions,
    fetch_courses_by_department,
    fetch_students_by_division,
    mark_session_attendance,
    fetch_marked_sessions_for_date,
    fetch_previous_lecture_session,
    undo_lecture_session,
    bulk_import_roster
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/my")
async def get_my_attendance(
    semester: Optional[int] = Query(None, description="Optional semester filter, defaults to student active semester"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch attendance summary and per-subject risk calculation for current authenticated student."""
    return await fetch_student_attendance_records(db, current_user.id, target_semester=semester)


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
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Faculty Dashboard endpoint: Returns attendance breakdown scoped to Faculty's Department & Subjects."""
    return await fetch_all_students_faculty_overview(
        db,
        faculty_user=current_user,
        faculty_dept_id=current_user.department_id,
        dept_code=dept_code,
        div_name=div_name
    )


@router.get("/faculty/departments")
async def get_faculty_departments(
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns list of departments and divisions available for current faculty."""
    return await fetch_faculty_departments_and_divisions(
        db,
        faculty_dept_id=current_user.department_id
    )


@router.get("/faculty/courses")
async def get_faculty_courses(
    dept_code: Optional[str] = Query(None),
    department_code: Optional[str] = Query(None),
    semester: Optional[int] = Query(5),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns courses for lecture session selection, scoped to the faculty member in the ongoing semester."""
    code = department_code or dept_code or "COMP"
    return await fetch_courses_by_department(db, code, semester=semester, faculty_id=current_user.id)


@router.get("/faculty/students")
async def get_faculty_division_students(
    dept_code: Optional[str] = Query(None),
    department_code: Optional[str] = Query(None),
    div_name: Optional[str] = Query(None),
    division_name: Optional[str] = Query(None),
    batch_name: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns student roster for a specific Department + Division (e.g. COMP-A, COMP-B) and optional batch."""
    code = department_code or dept_code or "COMP"
    dname = division_name or div_name or "A"
    return await fetch_students_by_division(db, code, dname, batch_name=batch_name)


@router.get("/faculty/sessions")
async def get_faculty_marked_sessions(
    subject: str = Query(...),
    session_date: str = Query(...),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Fetches marked lecture sessions for a given date and subject to display session history & enable Undo."""
    return await fetch_marked_sessions_for_date(
        db=db,
        faculty_id=current_user.id,
        subject=subject,
        session_date=session_date
    )


@router.get("/faculty/sessions/previous")
async def get_previous_lecture_session(
    subject: str = Query(...),
    before_date: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns the most recent marked lecture session for copying attendance."""
    return await fetch_previous_lecture_session(
        db=db,
        faculty_id=current_user.id,
        subject=subject,
        before_date=before_date
    )


@router.post("/faculty/mark")
async def mark_attendance_endpoint(
    req: MarkAttendanceRequest,
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
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
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
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
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
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


# ===========================================================================
# Institutional Attendance Condonation & Official Defaulter Governance (Rule 4.2)
# ===========================================================================

@router.post("/condonation", summary="Grant attendance condonation under Autonomous Scheme Rule 4.2")
async def grant_condonation_endpoint(
    payload: CreateCondonationRequest,
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Grants official condonation (medical leave / official duty under Rule 4.2).
    Updates AttendanceCondonation audit registry and reflects real-time in student attendance.
    """
    stu_res = await db.execute(select(User).where(User.id == payload.student_id))
    student = stu_res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    condonation = AttendanceCondonation(
        student_id=payload.student_id,
        subject=payload.subject,
        leave_type=payload.leave_type,
        missed_sessions_count=payload.missed_sessions_count,
        granted_classes=payload.granted_classes,
        reason=payload.reason,
        approved_by=current_user.id,
        status="APPROVED",
    )
    db.add(condonation)

    # Update student's AttendanceLog in real time
    log_stmt = select(AttendanceLog).where(
        AttendanceLog.student_id == payload.student_id,
        AttendanceLog.subject.ilike(f"%{payload.subject}%")
    )
    log_res = await db.execute(log_stmt)
    log = log_res.scalar_one_or_none()
    if log:
        log.attended_classes = min(log.total_classes, log.attended_classes + payload.granted_classes)
        new_pct = round((log.attended_classes / log.total_classes) * 100, 2)
    else:
        new_pct = 75.0

    await db.commit()
    await db.refresh(condonation)

    return {
        "status": "success",
        "condonation_id": str(condonation.id),
        "student_name": student.full_name,
        "subject": payload.subject,
        "leave_type": payload.leave_type,
        "granted_classes": payload.granted_classes,
        "new_attendance_percentage": new_pct,
        "message": f"Successfully granted {payload.granted_classes} condoned sessions under Rule 4.2 for {student.full_name} ({payload.subject}).",
    }


@router.get("/condonations", summary="List attendance condonation audit records")
async def list_condonations_endpoint(
    student_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(require_role(["FACULTY", "ADMIN", "STUDENT"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns official condonation audit records."""
    stmt = (
        select(AttendanceCondonation)
        .options(
            selectinload(AttendanceCondonation.student),
            selectinload(AttendanceCondonation.approver)
        )
        .order_by(AttendanceCondonation.created_at.desc())
    )

    if current_user.role == "STUDENT":
        stmt = stmt.where(AttendanceCondonation.student_id == current_user.id)
    elif student_id:
        stmt = stmt.where(AttendanceCondonation.student_id == student_id)

    res = await db.execute(stmt)
    records = res.scalars().all()
    return [
        {
            "id": str(r.id),
            "student_id": str(r.student_id),
            "student_name": r.student.full_name if r.student else "Student",
            "subject": r.subject,
            "leave_type": r.leave_type,
            "missed_sessions_count": r.missed_sessions_count,
            "granted_classes": r.granted_classes,
            "reason": r.reason,
            "status": r.status,
            "approved_by_name": r.approver.full_name if r.approver else "Academic Dean / HOD",
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in records
    ]


@router.get("/defaulters", summary="Official Defaulter Notice (Form 4) Registry")
async def get_defaulters_registry(
    dept_code: Optional[str] = Query("COMP"),
    min_threshold: float = Query(75.0),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Compiles the University Form 4 Defaulter List for display & print.
    Groups students into Critical, Severe, and Borderline (Condonation-Eligible).
    """
    overview = await fetch_all_students_faculty_overview(db, dept_code)
    all_students = overview.get("students", [])

    defaulters = []
    for s in all_students:
        pct = s.get("overall_percentage", 0)
        if pct < min_threshold:
            if pct < 50.0:
                category = "CRITICAL"
                action = "Parent Summons & Academic Debarment Warning"
            elif pct < 65.0:
                category = "SEVERE"
                action = "Formal Written Undertaking & Remedial Sessions"
            else:
                category = "BORDERLINE"
                action = "Condonation Review Eligible (Autonomous Rule 4.2)"

            defaulters.append({
                "student_id": str(s.get("student_id")),
                "roll_no": s.get("roll_no") or s.get("email", "").split("@")[0].split(".")[-1] or "-",
                "full_name": s.get("student_name"),
                "email": s.get("student_email"),
                "overall_percentage": pct,
                "category": category,
                "recommended_action": action,
                "is_condonation_eligible": pct >= 65.0,
                "subjects_at_risk": s.get("subjects_at_risk", 0),
                "total_subjects": s.get("total_subjects", 0),
            })

    defaulters.sort(key=lambda x: x["overall_percentage"])
    return {
        "status": "success",
        "department": dept_code,
        "threshold": min_threshold,
        "total_defaulters_count": len(defaulters),
        "defaulters": defaulters,
    }

