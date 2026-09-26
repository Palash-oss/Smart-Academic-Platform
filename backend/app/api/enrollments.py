"""
Allotment Engine API Routes — Revision FRCRCE-3-26
===================================================

Admin Endpoints:
  POST  /api/v1/enrollments/upload-allotment      — Excel ingestion & allotment
  PATCH /api/v1/sections/{section_id}/assign-faculty  — Assign faculty to section (cascades)
  PATCH /api/v1/batches/{batch_id}/assign-faculty     — Assign faculty directly to batch
  GET   /api/v1/enrollments/offerings             — List all offerings (admin)

Student Portal:
  GET   /api/v1/student/my-enrollments            — Authenticated student enrollment view
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user, require_role
from app.db.models import (
    ClassSection, Course, CourseOffering, PracticalBatch, StudentEnrollment, User,
)
from app.db.session import get_db
from app.schemas.allotment import (
    AllotmentUploadResponse,
    AssignFacultyToBatchRequest,
    AssignFacultyToSectionRequest,
    ClassSectionRead,
    MyEnrollmentsResponse,
    EnrollmentEntry,
    TheorySlot,
    PracticalSlot,
    PracticalBatchRead,
    FacultySubjectsResponse,
    FacultyCourseItem,
    FacultySectionItem,
    FacultyBatchItem,
)
from app.services.allotment_service import AllotmentEngine, CASCADE_MODES, cascade_faculty_to_batches

router = APIRouter(tags=["Allotment Engine"])


# ===========================================================================
# ADMIN: Upload Allotment Sheet
# ===========================================================================

@router.post(
    "/v1/enrollments/upload-allotment",
    response_model=AllotmentUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload allotment Excel/CSV to auto-create sections and batches",
)
async def upload_allotment(
    file: UploadFile = File(..., description="Excel (.xlsx) or CSV file"),
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Multipart upload of the student allotment sheet.

    - Validates all student_ids and course_codes against the database.
    - Runs the tier-based balanced batch-splitting algorithm.
    - Wraps the entire operation in a single DB transaction.
    - On any validation failure, rolls back and returns a structured error report.
    """
    if not file.filename.lower().endswith((".xlsx", ".csv")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .xlsx or .csv files are accepted",
        )

    file_bytes = await file.read()

    try:
        async with db.begin():
            engine = AllotmentEngine(db)
            summary = await engine.process_file(file_bytes, file.filename)

            if summary["errors"] and summary["status"] == "partial":
                # Partial success — still committed what was valid
                pass

        return AllotmentUploadResponse(**summary)

    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Allotment processing failed: {exc}",
        )


# ===========================================================================
# ADMIN: Assign Faculty to Theory Section (with cascade)
# ===========================================================================

@router.patch(
    "/v1/sections/{section_id}/assign-faculty",
    response_model=ClassSectionRead,
    summary="Assign faculty to a theory section (auto-cascades for INTEGRATED_TH_PR / THEORY_TUTORIAL)",
)
async def assign_faculty_to_section(
    section_id: uuid.UUID,
    payload: AssignFacultyToSectionRequest,
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign a FACULTY user to a theory section.

    For courses with delivery_mode in {INTEGRATED_TH_PR, THEORY_TUTORIAL},
    the assignment automatically cascades to all child PracticalBatches.
    """
    async with db.begin():
        # Fetch section with offering → course (for delivery_mode check)
        stmt = (
            select(ClassSection)
            .where(ClassSection.id == section_id)
            .options(
                selectinload(ClassSection.offering).selectinload(CourseOffering.course),
                selectinload(ClassSection.faculty),
            )
        )
        result = await db.execute(stmt)
        section = result.scalar_one_or_none()
        if section is None:
            raise HTTPException(status_code=404, detail="Section not found")

        # Verify faculty user exists and has FACULTY role
        fac_stmt = select(User).where(User.id == payload.faculty_id, User.role == "FACULTY")
        fac_result = await db.execute(fac_stmt)
        faculty = fac_result.scalar_one_or_none()
        if faculty is None:
            raise HTTPException(status_code=404, detail="Faculty user not found or not a FACULTY role")

        section.faculty_id = payload.faculty_id

        # Cascade to batches when applicable
        cascaded = 0
        delivery_mode = section.offering.course.delivery_mode
        if delivery_mode in CASCADE_MODES:
            cascaded = await cascade_faculty_to_batches(db, section_id, payload.faculty_id)

    return ClassSectionRead(
        id=section.id,
        section_name=section.section_name,
        offering_id=section.offering_id,
        faculty_id=section.faculty_id,
        faculty_name=faculty.full_name if faculty else None,
    )


# ===========================================================================
# ADMIN: Assign Faculty Directly to Practical Batch
# ===========================================================================

@router.patch(
    "/v1/batches/{batch_id}/assign-faculty",
    response_model=PracticalBatchRead,
    summary="Assign faculty directly to a practical batch (for PRACTICAL_ONLY courses)",
)
async def assign_faculty_to_batch(
    batch_id: uuid.UUID,
    payload: AssignFacultyToBatchRequest,
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign a FACULTY user to a specific practical batch.
    Required for PRACTICAL_ONLY courses where each batch has an independent faculty slot.
    """
    async with db.begin():
        stmt = select(PracticalBatch).where(PracticalBatch.id == batch_id)
        result = await db.execute(stmt)
        batch = result.scalar_one_or_none()
        if batch is None:
            raise HTTPException(status_code=404, detail="Batch not found")

        fac_stmt = select(User).where(User.id == payload.faculty_id, User.role == "FACULTY")
        fac_result = await db.execute(fac_stmt)
        faculty = fac_result.scalar_one_or_none()
        if faculty is None:
            raise HTTPException(status_code=404, detail="Faculty user not found or not a FACULTY role")

        batch.faculty_id = payload.faculty_id

    return PracticalBatchRead(
        id=batch.id,
        batch_name=batch.batch_name,
        offering_id=batch.offering_id,
        section_id=batch.section_id,
        faculty_id=batch.faculty_id,
        faculty_name=faculty.full_name if faculty else None,
    )


# ===========================================================================
# STUDENT PORTAL: My Enrollments
# ===========================================================================

@router.get(
    "/v1/student/my-enrollments",
    response_model=MyEnrollmentsResponse,
    summary="Student: view all enrolled courses with section/batch/faculty details",
)
async def my_enrollments(
    academic_term: str = Query(..., description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["STUDENT"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Protected endpoint for authenticated STUDENT role.

    Returns all enrolled courses for the given academic_term with:
    - Course meta (code, name, tier, delivery_mode)
    - Theory section name + faculty name (or 'To be assigned')
    - Practical batch name + faculty name (or 'To be assigned')
    """
    stmt = (
        select(StudentEnrollment)
        .where(
            StudentEnrollment.student_id == current_user.id,
        )
        .options(
            selectinload(StudentEnrollment.offering).options(
                selectinload(CourseOffering.course),
            ),
            selectinload(StudentEnrollment.section).selectinload(ClassSection.faculty),
            selectinload(StudentEnrollment.batch).selectinload(PracticalBatch.faculty),
        )
    )
    result = await db.execute(stmt)
    enrollments_raw = result.scalars().all()

    # Filter by term after eager load (avoids complex join)
    enrollments_raw = [
        e for e in enrollments_raw
        if e.offering.academic_term == academic_term
    ]

    entries: list[EnrollmentEntry] = []
    for e in enrollments_raw:
        course = e.offering.course

        # Theory slot
        theory_slot: Optional[TheorySlot] = None
        if e.section is not None:
            fac_name = e.section.faculty.full_name if e.section.faculty else "To be assigned"
            theory_slot = TheorySlot(section=e.section.section_name, faculty=fac_name)
        elif course.delivery_mode not in ("PRACTICAL_ONLY",):
            theory_slot = None  # no section created yet

        # Practical slot
        practical_slot: Optional[PracticalSlot] = None
        if e.batch is not None:
            fac_name = e.batch.faculty.full_name if e.batch.faculty else "To be assigned"
            practical_slot = PracticalSlot(batch=e.batch.batch_name, faculty=fac_name)

        entries.append(
            EnrollmentEntry(
                course_code=course.code,
                course_name=course.name,
                tier=course.course_tier,
                delivery_mode=course.delivery_mode,
                theory=theory_slot,
                practical=practical_slot,
            )
        )

    return MyEnrollmentsResponse(
        student_id=current_user.student_erp_id or str(current_user.id),
        academic_term=academic_term,
        enrollments=entries,
    )


# ===========================================================================
# FACULTY PORTAL: My Assigned Subjects & Batches
# ===========================================================================

@router.get(
    "/v1/faculty/my-subjects",
    response_model=FacultySubjectsResponse,
    summary="Faculty: view all courses, theory sections, and lab batches assigned to this faculty member",
)
async def faculty_my_subjects(
    academic_term: str = Query(..., description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["FACULTY", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Protected endpoint for authenticated FACULTY (and ADMIN) role.

    Returns all courses in the specified academic_term where this faculty member
    is assigned to teach Theory Sections or Practical/Lab/Tutorial Batches.
    """
    stmt = (
        select(CourseOffering)
        .where(CourseOffering.academic_term == academic_term)
        .options(
            selectinload(CourseOffering.course),
            selectinload(CourseOffering.sections).selectinload(ClassSection.faculty),
            selectinload(CourseOffering.sections).selectinload(ClassSection.enrollments),
            selectinload(CourseOffering.batches).selectinload(PracticalBatch.faculty),
            selectinload(CourseOffering.batches).selectinload(PracticalBatch.enrollments),
            selectinload(CourseOffering.batches).selectinload(PracticalBatch.section),
            selectinload(CourseOffering.enrollments),
        )
    )
    result = await db.execute(stmt)
    all_offerings = result.scalars().all()

    faculty_id = current_user.id
    assigned_courses: list[FacultyCourseItem] = []

    total_sections_count = 0
    total_batches_count = 0
    total_distinct_students: set[uuid.UUID] = set()

    for off in all_offerings:
        # Check if sections or batches are assigned to this faculty
        my_sections = [s for s in off.sections if s.faculty_id == faculty_id]
        my_batches = [b for b in off.batches if b.faculty_id == faculty_id]

        # For Admin viewing or if assigned
        if not my_sections and not my_batches:
            continue

        course = off.course
        course_student_ids: set[uuid.UUID] = set()

        sec_items: list[FacultySectionItem] = []
        for s in my_sections:
            count = len(s.enrollments)
            for enr in s.enrollments:
                course_student_ids.add(enr.student_id)
                total_distinct_students.add(enr.student_id)
            sec_items.append(
                FacultySectionItem(
                    id=s.id,
                    section_name=s.section_name,
                    student_count=count,
                )
            )

        batch_items: list[FacultyBatchItem] = []
        for b in my_batches:
            count = len(b.enrollments)
            for enr in b.enrollments:
                course_student_ids.add(enr.student_id)
                total_distinct_students.add(enr.student_id)
            sec_name = b.section.section_name if b.section else None
            batch_items.append(
                FacultyBatchItem(
                    id=b.id,
                    batch_name=b.batch_name,
                    student_count=count,
                    section_name=sec_name,
                )
            )

        total_sections_count += len(sec_items)
        total_batches_count += len(batch_items)

        assigned_courses.append(
            FacultyCourseItem(
                offering_id=off.id,
                course_code=course.code,
                course_name=course.name,
                tier=course.course_tier,
                delivery_mode=course.delivery_mode,
                th_hours=course.th_hours,
                pr_hours=course.pr_hours,
                tu_hours=course.tu_hours,
                sections=sec_items,
                batches=batch_items,
                total_students=len(course_student_ids),
            )
        )

    # If faculty has no direct section/batch assignments yet, check if there are offerings in their department to suggest or display
    return FacultySubjectsResponse(
        faculty_id=str(current_user.id),
        faculty_name=current_user.full_name,
        department_name="Computer Engineering",
        academic_term=academic_term,
        total_courses=len(assigned_courses),
        total_sections=total_sections_count,
        total_batches=total_batches_count,
        total_students=len(total_distinct_students),
        courses=assigned_courses,
    )


# ===========================================================================
# ADMIN: List All Offerings (utility)
# ===========================================================================

@router.get(
    "/v1/enrollments/offerings",
    summary="Admin: list all course offerings with sections and batches",
)
async def list_offerings(
    academic_term: Optional[str] = Query(None, description="Filter by academic term"),
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """List all CourseOfferings with nested sections and batches. Admin / Faculty only."""
    stmt = select(CourseOffering).options(
        selectinload(CourseOffering.course),
        selectinload(CourseOffering.sections).selectinload(ClassSection.faculty),
        selectinload(CourseOffering.batches).selectinload(PracticalBatch.faculty),
    )
    if academic_term:
        stmt = stmt.where(CourseOffering.academic_term == academic_term)

    result = await db.execute(stmt)
    offerings = result.scalars().all()

    def _fac_name(fac: Optional[User]) -> Optional[str]:
        return fac.full_name if fac else None

    return [
        {
            "id": str(o.id),
            "course_code": o.course.code,
            "course_name": o.course.name,
            "course_tier": o.course.course_tier,
            "delivery_mode": o.course.delivery_mode,
            "academic_term": o.academic_term,
            "sections": [
                {
                    "id": str(s.id),
                    "section_name": s.section_name,
                    "faculty_id": str(s.faculty_id) if s.faculty_id else None,
                    "faculty_name": _fac_name(s.faculty),
                }
                for s in o.sections
            ],
            "batches": [
                {
                    "id": str(b.id),
                    "batch_name": b.batch_name,
                    "section_id": str(b.section_id) if b.section_id else None,
                    "faculty_id": str(b.faculty_id) if b.faculty_id else None,
                    "faculty_name": _fac_name(b.faculty),
                }
                for b in o.batches
            ],
        }
        for o in offerings
    ]
