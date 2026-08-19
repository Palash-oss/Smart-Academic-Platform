import uuid
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import AttendanceLog, User


def calculate_attendance_percentage(attended: int, total: int) -> float:
    """Calculates attendance percentage strictly in Python.
    
    Returns 0.0 if total is 0.
    """
    if total <= 0:
        return 0.0
    return round((attended / total) * 100.0, 2)


def is_attendance_at_risk(percentage: float, threshold: float = 75.0) -> bool:
    """Determines whether an attendance percentage falls below the policy threshold (default 75%)."""
    return percentage < threshold


def calculate_classes_needed_for_target(attended: int, total: int, target_pct: float = 75.0) -> int:
    """Calculates how many additional consecutive classes a student must attend to reach target_pct."""
    if total <= 0:
        return 0
    current_pct = (attended / total) * 100.0
    if current_pct >= target_pct:
        return 0
    
    target_frac = target_pct / 100.0
    needed = ((target_frac * total) - attended) / (1.0 - target_frac)
    import math
    return max(0, math.ceil(needed))


async def fetch_student_attendance_records(
    db: AsyncSession,
    student_id: uuid.UUID
) -> Dict[str, Any]:
    """Fetches attendance records for a specific student and computes exact risk flags & percentages."""
    stmt = select(AttendanceLog).where(AttendanceLog.student_id == student_id)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    user_stmt = select(User).where(User.id == student_id)
    user_res = await db.execute(user_stmt)
    student = user_res.scalar_one_or_none()

    subject_records = []
    total_attended_all = 0
    total_classes_all = 0

    for log in logs:
        pct = calculate_attendance_percentage(log.attended_classes, log.total_classes)
        at_risk = is_attendance_at_risk(pct)
        classes_needed = calculate_classes_needed_for_target(log.attended_classes, log.total_classes, 75.0)
        
        total_attended_all += log.attended_classes
        total_classes_all += log.total_classes

        subject_records.append({
            "id": str(log.id),
            "subject": log.subject,
            "total_classes": log.total_classes,
            "attended_classes": log.attended_classes,
            "percentage": pct,
            "is_at_risk": at_risk,
            "classes_needed_to_clear_risk": classes_needed
        })

    overall_pct = calculate_attendance_percentage(total_attended_all, total_classes_all)
    overall_risk = is_attendance_at_risk(overall_pct)

    return {
        "student_id": str(student_id),
        "student_name": student.full_name if student else "Unknown Student",
        "overall_percentage": overall_pct,
        "overall_risk": overall_risk,
        "total_subjects": len(subject_records),
        "subjects": subject_records
    }


async def fetch_all_students_faculty_overview(
    db: AsyncSession
) -> List[Dict[str, Any]]:
    """Fetches attendance summary for all students (Faculty Dashboard)."""
    stmt = select(User).where(User.role == "STUDENT")
    result = await db.execute(stmt)
    students = result.scalars().all()

    overview = []
    for student in students:
        summary = await fetch_student_attendance_records(db, student.id)
        subjects_at_risk = sum(1 for s in summary["subjects"] if s["is_at_risk"])
        
        overview.append({
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_email": student.email,
            "overall_percentage": summary["overall_percentage"],
            "overall_risk": summary["overall_risk"],
            "total_subjects": summary["total_subjects"],
            "subjects_at_risk": subjects_at_risk,
            "subjects": summary["subjects"]
        })

    return overview


async def mark_session_attendance(
    db: AsyncSession,
    subject: str,
    present_student_ids: List[uuid.UUID],
    all_enrolled_student_ids: List[uuid.UUID]
) -> Dict[str, Any]:
    """Marks a live lecture session's attendance:
    - Increments total_classes by 1 for all enrolled students
    - Increments attended_classes by 1 for present students
    - Executes real SQL UPDATE on attendance_logs table
    """
    present_set = set(present_student_ids)
    updated_count = 0

    for student_id in all_enrolled_student_ids:
        stmt = select(AttendanceLog).where(
            AttendanceLog.student_id == student_id,
            AttendanceLog.subject == subject
        )
        res = await db.execute(stmt)
        log = res.scalar_one_or_none()

        if log:
            log.total_classes += 1
            if student_id in present_set:
                log.attended_classes += 1
        else:
            is_present = student_id in present_set
            log = AttendanceLog(
                student_id=student_id,
                subject=subject,
                total_classes=1,
                attended_classes=1 if is_present else 0
            )
            db.add(log)
        updated_count += 1

    await db.commit()

    present_count = len(present_set)
    absent_count = len(all_enrolled_student_ids) - present_count

    return {
        "subject": subject,
        "total_marked": updated_count,
        "present_count": present_count,
        "absent_count": absent_count
    }


async def bulk_import_roster(
    db: AsyncSession,
    students_data: List[Dict[str, str]]
) -> Dict[str, Any]:
    """Bulk imports student roster from parsed CSV data:
    - Creates student User if email doesn't exist
    - Initializes attendance_logs rows for all subjects at (0, 0)
    """
    from app.core.security import hash_password
    import secrets

    subjects = [
        "Data Structures & Algorithms",
        "Operating Systems",
        "Database Management Systems",
        "Computer Networks"
    ]

    created_count = 0
    skipped_count = 0
    created_credentials = []

    for row in students_data:
        email = row.get("email", "").strip().lower()
        full_name = row.get("name", "").strip()

        if not email or not full_name:
            continue

        stmt = select(User).where(User.email == email)
        res = await db.execute(stmt)
        existing_user = res.scalar_one_or_none()

        if existing_user:
            skipped_count += 1
            continue

        raw_password = f"Pass{secrets.randbelow(8999) + 1000}!"
        new_user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(raw_password),
            role="STUDENT"
        )
        db.add(new_user)
        await db.flush()

        for sub in subjects:
            log = AttendanceLog(
                student_id=new_user.id,
                subject=sub,
                total_classes=0,
                attended_classes=0
            )
            db.add(log)

        created_count += 1
        created_credentials.append({
            "name": full_name,
            "email": email,
            "default_password": raw_password
        })

    await db.commit()

    return {
        "created": created_count,
        "skipped_duplicates": skipped_count,
        "credentials": created_credentials
    }
