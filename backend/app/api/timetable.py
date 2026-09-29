"""
Timetable API Endpoints — Revision FRCRCE-3-26
===============================================
Endpoints for:
1. Allotment readiness verification (guard check).
2. Admin conflict-free master timetable generation.
3. Master division timetable visualization (official paper format).
4. Personalized faculty timetable (assigned classes only).
5. Personalized student timetable (enrolled section, lab batch & electives only).
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.api.auth import get_current_user, require_role
from app.db.models import User, TimetableSlot
from app.db.session import get_db
from app.schemas.timetable import (
    MasterTimetableResponse,
    FacultyTimetableResponse,
    StudentTimetableResponse,
    TimetableStatusResponse,
    TimetableGenerateRequest,
)
from app.services.timetable_service import TimetableService

router = APIRouter(tags=["Timetable Engine"])


@router.get(
    "/v1/timetable/status",
    response_model=TimetableStatusResponse,
    summary="Check allotment completion and timetable status",
)
async def get_timetable_status(
    academic_term: str = Query("2026-27-SEM5", description="Academic term"),
    db: AsyncSession = Depends(get_db),
):
    """
    Checks if course & batch allotments are committed and whether timetable slots exist.
    Serves as the guard check before timetable generation.
    """
    service = TimetableService(db)
    return await service.check_allotment_status(academic_term)


@router.post(
    "/v1/timetable/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Generate conflict-free timetable based on finalized allotment",
)
async def generate_timetable(
    payload: TimetableGenerateRequest,
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only endpoint: Schedules lectures, parallel 2-hour lab batches, break columns,
    honors, and mini-project sessions across divisions based strictly on the committed allotment records.
    """
    service = TimetableService(db)
    try:
        created_count = await service.generate_timetable(
            academic_term=payload.academic_term,
            room_number=payload.room_number,
            overwrite=payload.overwrite,
        )
        return {
            "status": "success",
            "academic_term": payload.academic_term,
            "slots_created": created_count,
            "message": f"Successfully generated {created_count} timetable slots for {payload.academic_term} across divisions.",
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Timetable generation failed: {exc}",
        )


@router.get(
    "/v1/timetable/master",
    response_model=MasterTimetableResponse,
    summary="View Master Timetable grid in official college paper format",
)
async def get_master_timetable(
    academic_term: str = Query("2026-27-SEM5", description="e.g. '2026-27-SEM5'"),
    division_name: str = Query("B", description="Division: 'A' or 'B'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the comprehensive weekly timetable grid matching the exact college paper format:
    - Header with Room 703, Class Teacher, Term duration
    - Short Break & Lunch Break columns
    - Multi-batch parallel practical cells (e.g. DC/SE/AIL/CSS, A/B/C/D, KG/SGN/SNF/SSA)
    - Complete Subject Abbreviation and Faculty Legend tables at the bottom
    """
    service = TimetableService(db)
    clean_div = division_name.replace("COMP-", "").strip().upper()
    try:
        return await service.get_master_timetable(academic_term, clean_div)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.get(
    "/v1/timetable/faculty/me",
    response_model=FacultyTimetableResponse,
    summary="Faculty: Personalized weekly schedule showing only their assigned classes",
)
async def get_faculty_my_timetable(
    academic_term: str = Query("2026-27-SEM5", description="Academic term"),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the personalized timetable for the logged-in teacher:
    - Only their assigned lectures and lab batches
    - Division, Batch, Classroom room numbers
    - Empty slots marked as free prep time
    - Weekly workload badge (Total hours, Theory hours, Practical hours)
    """
    service = TimetableService(db)
    return await service.get_faculty_timetable(current_user, academic_term)


@router.get(
    "/v1/timetable/student/me",
    response_model=StudentTimetableResponse,
    summary="Student: Personalized weekly schedule showing their exact section and batch classes",
)
async def get_student_my_timetable(
    academic_term: str = Query("2026-27-SEM5", description="Academic term"),
    current_user: User = Depends(require_role(["STUDENT", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the personalized timetable for the logged-in student:
    - Division theory classes
    - Student's specific lab batch (e.g. B1 only, omitting other batches)
    - Specific allocated electives (PEC, PECL, OE)
    - Today's upcoming session card
    """
    service = TimetableService(db)
    return await service.get_student_timetable(current_user, academic_term)


@router.delete(
    "/v1/timetable/clear",
    summary="Admin/Faculty: Clear generated timetable for a term",
)
@router.post(
    "/v1/timetable/clear",
    summary="Admin/Faculty: Clear generated timetable for a term (POST)",
)
@router.delete(
    "/v1/timetable/dissolve",
    summary="Admin/Faculty: Dissolve generated timetable for a term",
)
@router.post(
    "/v1/timetable/dissolve",
    summary="Admin/Faculty: Dissolve generated timetable for a term (POST)",
)
async def clear_timetable(
    academic_term: Optional[str] = Query(None, description="Academic term to clear"),
    payload: Optional[dict] = Body(None),
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """Admin/Faculty: Removes all generated timetable slots for the specified term."""
    term = (
        academic_term
        or (payload.get("academic_term") if isinstance(payload, dict) else None)
        or "2026-27-SEM5"
    )
    result = await db.execute(
        delete(TimetableSlot).where(TimetableSlot.academic_term == term)
    )
    await db.commit()
    deleted_count = result.rowcount if hasattr(result, "rowcount") and result.rowcount is not None else 0
    return {
        "status": "success",
        "academic_term": term,
        "slots_deleted": deleted_count,
        "message": f"Successfully dissolved timetable for {term}. Removed scheduled slots.",
    }
