"""
API Endpoints for Exam Cell, Assessment Blueprints, Marks Gradebook, and OBE Attainment.
"""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.exam import (
    ExamTemplateOut,
    ExamTemplateIn,
    GradebookResponse,
    BatchMarksSavePayload,
    LockActionPayload,
    UnlockRequestPayload,
    UnlockRequestOut,
    OBEAttainmentResponse,
    StudentCourseGradeSummary,
)
from app.services.exam_service import ExamService, ExamServiceError

router = APIRouter(prefix="/v1/exams", tags=["Exam Cell & Gradebook"])


# ---------------------------------------------------------------------------
# Faculty Endpoints
# ---------------------------------------------------------------------------

@router.get("/my-courses")
async def list_faculty_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List assigned courses for faculty with assessment completion indicators."""
    service = ExamService(db)
    return await service.list_faculty_offerings(current_user)


@router.get("/courses/{offering_id}/template", response_model=ExamTemplateOut)
async def get_course_template(
    offering_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the assessment blueprint (components, sub-components, syllabus COs) for this course offering."""
    service = ExamService(db)
    try:
        return await service.get_or_create_template(offering_id, current_user)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/courses/{offering_id}/template", response_model=ExamTemplateOut)
async def update_course_template(
    offering_id: uuid.UUID,
    data: ExamTemplateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update assessment scheme: customize ISE division, add questions, and map to COs."""
    service = ExamService(db)
    try:
        return await service.update_template(offering_id, current_user, data)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/courses/{offering_id}/gradebook", response_model=GradebookResponse)
async def get_course_gradebook(
    offering_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full spreadsheet grid data: enrolled student roster, evaluation columns, marks, and lock status."""
    service = ExamService(db)
    try:
        return await service.get_gradebook(offering_id, current_user)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/courses/{offering_id}/marks")
async def save_course_marks(
    offering_id: uuid.UUID,
    payload: BatchMarksSavePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save / update a batch of student marks with automatic audit trail."""
    service = ExamService(db)
    try:
        return await service.save_batch_marks(offering_id, current_user, payload)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/courses/{offering_id}/lock")
async def lock_evaluation_marks(
    offering_id: uuid.UUID,
    payload: LockActionPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lock marks after evaluation review so they become immutable."""
    service = ExamService(db)
    try:
        return await service.lock_marks(offering_id, current_user, payload.component_type)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/courses/{offering_id}/unlock-request", response_model=UnlockRequestOut)
async def request_unlock_marks(
    offering_id: uuid.UUID,
    payload: UnlockRequestPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit formal unlock request with justification for post-deadline corrections."""
    service = ExamService(db)
    try:
        return await service.request_unlock(offering_id, current_user, payload.component_type, payload.reason)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/courses/{offering_id}/attainment", response_model=OBEAttainmentResponse)
async def get_course_obe_attainment(
    offering_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate and return Course Outcome (CO) and Program Outcome (PO) attainment."""
    service = ExamService(db)
    try:
        return await service.compute_obe_attainment(offering_id)
    except ExamServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


# ---------------------------------------------------------------------------
# Student Portal Endpoints
# ---------------------------------------------------------------------------

@router.get("/student/my-grades", response_model=List[StudentCourseGradeSummary])
async def get_my_grades(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """View verified marks and component breakdown for the logged-in student."""
    service = ExamService(db)
    return await service.get_student_grades(current_user)
