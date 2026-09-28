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
import io
import pandas as pd
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user, require_role
from app.core.security import hash_password
from app.db.models import (
    ClassSection, Course, CourseOffering, PracticalBatch, StudentEnrollment, User, Department,
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
    CreateFacultyRequest,
    FacultyAllocationUploadResponse,
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
        engine = AllotmentEngine(db)
        summary = await engine.process_file(file_bytes, file.filename)
        await db.commit()
        return AllotmentUploadResponse(**summary)

    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        await db.rollback()
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
    delivery_mode = section.offering.course.delivery_mode
    if delivery_mode in CASCADE_MODES:
        await cascade_faculty_to_batches(db, section_id, payload.faculty_id)

    await db.commit()

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
    await db.commit()

    return PracticalBatchRead(
        id=batch.id,
        batch_name=batch.batch_name,
        offering_id=batch.offering_id,
        section_id=batch.section_id,
        faculty_id=batch.faculty_id,
        faculty_name=faculty.full_name if faculty else None,
    )


# ===========================================================================
# ADMIN / FACULTY: List All Faculty Members
# ===========================================================================

@router.get(
    "/v1/faculty/all",
    summary="List all faculty members for assignment dropdowns",
)
async def list_all_faculty(
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.role == "FACULTY").order_by(User.full_name)
    result = await db.execute(stmt)
    faculty_list = result.scalars().all()
    return [
        {
            "id": str(f.id),
            "full_name": f.full_name,
            "email": f.email,
        }
        for f in faculty_list
    ]


# ===========================================================================
# ADMIN: Manually Create a New Faculty Member
# ===========================================================================

@router.post(
    "/v1/faculty/create",
    summary="Create / manually add a new faculty member",
)
async def create_faculty(
    payload: CreateFacultyRequest,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually add a new professor/instructor to the platform.
    Automatically assigns them the FACULTY role and links their department.
    """
    clean_email = payload.email.strip().lower()
    stmt = select(User).where(User.email == clean_email)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )

    # Department lookup
    dept = None
    if payload.department_code:
        dept_stmt = select(Department).where(
            (Department.code == payload.department_code.strip().upper())
            | (Department.name.ilike(f"%{payload.department_code.strip()}%"))
        )
        dept_res = await db.execute(dept_stmt)
        dept = dept_res.scalars().first()

    raw_pw = payload.password or "faculty123"
    new_faculty = User(
        email=clean_email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(raw_pw),
        role="FACULTY",
        department_id=dept.id if dept else None,
    )
    db.add(new_faculty)
    await db.commit()
    await db.refresh(new_faculty)

    return {
        "id": str(new_faculty.id),
        "full_name": new_faculty.full_name,
        "email": new_faculty.email,
        "department": dept.name if dept else (payload.department_code or "Computer Engineering"),
        "message": f"Faculty member {new_faculty.full_name} created successfully.",
    }


# ===========================================================================
# ADMIN: Upload Faculty Allocation / Teaching Matrix CSV or Excel
# ===========================================================================

@router.post(
    "/v1/admin/upload-faculty-allocation",
    response_model=FacultyAllocationUploadResponse,
    summary="Upload Faculty Allocation / Teaching Matrix CSV to auto-assign teachers to classes and batches",
)
async def upload_faculty_allocation(
    file: UploadFile = File(..., description="Faculty allocation matrix CSV or Excel"),
    academic_term: Optional[str] = Query(None, description="Fallback term, e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a Faculty Teaching Matrix CSV/Excel to auto-allocate professors to:
      1. Proper Class / Theory Sections (with cascade to child batches if integrated)
      2. Specific Practical Lab Batches (e.g., COMP-A-B1, COMP-A-B2)
    
    Accepts flexible column headers:
      - faculty_email / email / faculty_name
      - course_code / course / subject_code
      - class_div / division / section
      - batch_name / batch (optional: leave empty/ALL for theory class)
      - academic_term (optional: falls back to academic_term query parameter)
    """
    if not file.filename.lower().endswith((".xlsx", ".csv")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .xlsx or .csv files are accepted",
        )

    file_bytes = await file.read()
    try:
        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse file: {str(e)}",
        )

    # Normalize column names: strip and lowercase
    col_map = {str(c).strip().lower(): c for c in df.columns}

    # Locate faculty column
    faculty_col = None
    for cand in ["faculty_email", "email", "faculty", "faculty_name", "teacher", "professor"]:
        if cand in col_map:
            faculty_col = col_map[cand]
            break

    # Locate course column
    course_col = None
    for cand in ["course_code", "course", "subject_code", "code", "subject"]:
        if cand in col_map:
            course_col = col_map[cand]
            break

    if not faculty_col or not course_col:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV/Excel must contain at least faculty (email/name) and course_code columns.",
        )

    div_col = None
    for cand in ["class_div", "division", "section", "section_name", "class"]:
        if cand in col_map:
            div_col = col_map[cand]
            break

    batch_col = None
    for cand in ["batch_name", "batch", "batches", "lab_batch"]:
        if cand in col_map:
            batch_col = col_map[cand]
            break

    term_col = None
    for cand in ["academic_term", "term", "semester"]:
        if cand in col_map:
            term_col = col_map[cand]
            break

    default_term = academic_term or "2026-27-SEM5"

    total_processed = 0
    sections_assigned = 0
    batches_assigned = 0
    errors: list[str] = []

    # Cache faculty members
    all_fac_res = await db.execute(select(User).where(User.role == "FACULTY"))
    existing_faculties = {u.email.lower(): u for u in all_fac_res.scalars().all()}
    faculties_by_name = {u.full_name.lower(): u for u in existing_faculties.values()}

    for row_idx, row in df.iterrows():
        raw_fac = str(row[faculty_col]).strip() if pd.notna(row[faculty_col]) else ""
        raw_course = str(row[course_col]).strip() if pd.notna(row[course_col]) else ""

        if not raw_fac or not raw_course:
            continue

        row_term = default_term
        if term_col and pd.notna(row[term_col]) and str(row[term_col]).strip():
            row_term = str(row[term_col]).strip()

        raw_div = str(row[div_col]).strip() if div_col and pd.notna(row[div_col]) else ""
        raw_batch = str(row[batch_col]).strip() if batch_col and pd.notna(row[batch_col]) else ""

        total_processed += 1

        # 1. Resolve Faculty User
        fac_user = None
        if raw_fac.lower() in existing_faculties:
            fac_user = existing_faculties[raw_fac.lower()]
        elif raw_fac.lower() in faculties_by_name:
            fac_user = faculties_by_name[raw_fac.lower()]
        else:
            for fn, u in faculties_by_name.items():
                if raw_fac.lower() in fn or fn in raw_fac.lower():
                    fac_user = u
                    break

        if not fac_user:
            # Auto-create faculty member so matrix upload is self-healing
            email = raw_fac.lower() if "@" in raw_fac else f"{raw_fac.lower().replace(' ', '.')}@academic.edu"
            full_name = raw_fac if "@" not in raw_fac else raw_fac.split("@")[0].replace(".", " ").title()
            fac_user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password("faculty123"),
                role="FACULTY",
            )
            db.add(fac_user)
            await db.flush()
            existing_faculties[email] = fac_user
            faculties_by_name[full_name.lower()] = fac_user

        # 2. Resolve Course Offering
        off_stmt = (
            select(CourseOffering)
            .join(CourseOffering.course)
            .where(
                CourseOffering.academic_term == row_term,
                (Course.code.ilike(raw_course)) | (Course.name.ilike(f"%{raw_course}%")),
            )
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.sections),
                selectinload(CourseOffering.batches),
            )
        )
        off_res = await db.execute(off_stmt)
        offering = off_res.scalar_one_or_none()

        if not offering:
            errors.append(f"Row {row_idx + 1}: Offering for course '{raw_course}' in term '{row_term}' not found.")
            continue

        # 3. Allocation to Section or Batch
        is_batch_specific = raw_batch and raw_batch.lower() not in {"all", "theory", "none", "", "nan"}

        if is_batch_specific:
            # Specific practical batch(es) assigned
            batch_tokens = [b.strip() for b in raw_batch.replace(";", ",").split(",") if b.strip()]
            for b_token in batch_tokens:
                matched_b = None
                t_lower = b_token.lower()
                for b in offering.batches:
                    b_name_lower = b.batch_name.lower()
                    # Check exact match, substring match, or alias (B1 <-> Lab1)
                    is_match = False
                    if b_name_lower == t_lower or t_lower in b_name_lower:
                        is_match = True
                    elif "b1" in t_lower and ("lab1" in b_name_lower or "b1" in b_name_lower):
                        is_match = True
                    elif "b2" in t_lower and ("lab2" in b_name_lower or "b2" in b_name_lower):
                        is_match = True
                    elif "b3" in t_lower and ("lab3" in b_name_lower or "b3" in b_name_lower):
                        is_match = True
                    elif "b4" in t_lower and ("lab4" in b_name_lower or "b4" in b_name_lower):
                        is_match = True
                    elif "b5" in t_lower and ("lab5" in b_name_lower or "b5" in b_name_lower):
                        is_match = True
                    elif "b6" in t_lower and ("lab6" in b_name_lower or "b6" in b_name_lower):
                        is_match = True

                    if is_match:
                        # If division specified, prefer batch with division prefix, otherwise pick match
                        if raw_div and raw_div.lower() in b_name_lower:
                            matched_b = b
                            break
                        elif not matched_b:
                            matched_b = b

                if matched_b:
                    matched_b.faculty_id = fac_user.id
                    batches_assigned += 1
                else:
                    errors.append(f"Row {row_idx + 1}: Batch '{b_token}' not found under offering '{raw_course}'.")
        else:
            # Theory Section assignment (with automatic cascade if integrated/tutorial)
            matched_sec = None
            if offering.sections:
                for s in offering.sections:
                    if raw_div:
                        if raw_div.lower() in s.section_name.lower() or s.section_name.lower() in raw_div.lower():
                            matched_sec = s
                            break
                    else:
                        matched_sec = s
                        break
                # Fallback: If only 1 section exists under this offering (e.g. PEC elective), allocate to it!
                if not matched_sec and len(offering.sections) == 1:
                    matched_sec = offering.sections[0]

            if matched_sec:
                matched_sec.faculty_id = fac_user.id
                sections_assigned += 1
                if offering.course.delivery_mode in CASCADE_MODES:
                    c_count = await cascade_faculty_to_batches(db, matched_sec.id, fac_user.id)
                    batches_assigned += c_count
            elif not offering.sections and offering.batches:
                # PRACTICAL_ONLY course (batches link directly to offering, e.g. Linux lab or PECL)
                matched_any = False
                for b in offering.batches:
                    if not raw_div or raw_div.lower() in b.batch_name.lower():
                        b.faculty_id = fac_user.id
                        batches_assigned += 1
                        matched_any = True
                if not matched_any and offering.batches:
                    for b in offering.batches:
                        b.faculty_id = fac_user.id
                        batches_assigned += 1
            else:
                errors.append(f"Row {row_idx + 1}: No matching section found for division '{raw_div}' in course '{raw_course}'.")

    await db.commit()

    return FacultyAllocationUploadResponse(
        status="success" if not errors else "partial",
        academic_term=default_term,
        total_assignments_processed=total_processed,
        sections_assigned=sections_assigned,
        batches_assigned=batches_assigned,
        errors=errors,
    )


# ===========================================================================
# ADMIN: Auto-Enroll All Students into Mandatory Core Courses
# ===========================================================================

@router.post(
    "/v1/admin/auto-enroll-core",
    summary="Auto-enroll students of active divisions into Core PCC/VSEC courses",
)
async def auto_enroll_core(
    academic_term: str = Query(..., description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Auto-enrolls all students in active divisions into their mandatory Core courses.
    Zero manual CSV upload needed for Core courses!
    """
    engine = AllotmentEngine(db)
    summary = await engine.auto_enroll_core_for_term(academic_term)
    await db.commit()
    return summary


# ===========================================================================
# ADMIN: Auto-Assign Faculty to All Unassigned Slots
# ===========================================================================

@router.post(
    "/v1/admin/auto-assign-faculty",
    summary="Auto-assign available faculty to unassigned sections and batches in an academic term",
)
async def auto_assign_faculty(
    academic_term: str = Query(..., description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all faculty
    fac_stmt = select(User).where(User.role == "FACULTY").order_by(User.full_name)
    fac_res = await db.execute(fac_stmt)
    faculty_members = fac_res.scalars().all()
    if not faculty_members:
        raise HTTPException(status_code=400, detail="No faculty members found in database")

    # Fetch offerings for the term
    off_stmt = (
        select(CourseOffering)
        .where(CourseOffering.academic_term == academic_term)
        .options(
            selectinload(CourseOffering.course),
            selectinload(CourseOffering.sections),
            selectinload(CourseOffering.batches),
        )
    )
    off_res = await db.execute(off_stmt)
    offerings = off_res.scalars().all()

    assigned_count = 0
    fac_idx = 0
    num_fac = len(faculty_members)

    for off in offerings:
        delivery_mode = off.course.delivery_mode
        for sec in off.sections:
            if not sec.faculty_id:
                fac = faculty_members[fac_idx % num_fac]
                sec.faculty_id = fac.id
                fac_idx += 1
                assigned_count += 1
                if delivery_mode in CASCADE_MODES:
                    await cascade_faculty_to_batches(db, sec.id, fac.id)

        for b in off.batches:
            if not b.faculty_id:
                fac = faculty_members[fac_idx % num_fac]
                b.faculty_id = fac.id
                fac_idx += 1
                assigned_count += 1

    await db.commit()
    return {"status": "success", "academic_term": academic_term, "slots_assigned": assigned_count}


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
        student_name=current_user.full_name,
        roll_no=current_user.roll_no,
        academic_term=academic_term,
        enrollments=entries,
    )


def _parse_division_and_batch(name: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts human-readable (division_label, batch_label) from section or batch names.
    Examples:
      'COMP-A-Theory'       -> ('COMP Div A', None)
      'COMP-B-B3'           -> ('COMP Div B', 'Batch B3')
      'PEC13CE14-Sec1'      -> ('Elective Cohort 1', None)
      'PEC13CE14-Sec1-Lab2' -> ('Elective Cohort 1', 'Lab Batch 2')
    """
    if not name:
        return (None, None)
    import re
    # COMP-A-B1
    m_batch = re.match(r'^([A-Z]+)-([A-Z])-B(\d+)', name)
    if m_batch:
        return (f"{m_batch.group(1)} Div {m_batch.group(2)}", f"Batch B{m_batch.group(3)}")
    # COMP-A-Theory or COMP-A
    m_sec = re.match(r'^([A-Z]+)-([A-Z])', name)
    if m_sec:
        return (f"{m_sec.group(1)} Div {m_sec.group(2)}", None)
    # Elective Lab: PEC13CE14-Sec1-Lab2
    m_elab = re.search(r'Sec(\d+)-Lab(\d+)', name)
    if m_elab:
        return (f"Elective Sec {m_elab.group(1)}", f"Lab Batch {m_elab.group(2)}")
    # Elective Section: PEC13CE14-Sec1
    m_esec = re.search(r'Sec(\d+)', name)
    if m_esec:
        return (f"Elective Sec {m_esec.group(1)}", None)
    return (name, None)


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
            div_label, _ = _parse_division_and_batch(s.section_name)
            sec_items.append(
                FacultySectionItem(
                    id=s.id,
                    section_name=s.section_name,
                    student_count=count,
                    division=div_label,
                    component_type="THEORY",
                )
            )

        batch_items: list[FacultyBatchItem] = []
        for b in my_batches:
            count = len(b.enrollments)
            for enr in b.enrollments:
                course_student_ids.add(enr.student_id)
                total_distinct_students.add(enr.student_id)
            sec_name = b.section.section_name if b.section else None
            div_label, batch_lbl = _parse_division_and_batch(b.batch_name)
            if not div_label and sec_name:
                div_label, _ = _parse_division_and_batch(sec_name)
            batch_items.append(
                FacultyBatchItem(
                    id=b.id,
                    batch_name=b.batch_name,
                    student_count=count,
                    section_name=sec_name,
                    division=div_label,
                    batch_label=batch_lbl,
                    component_type="PRACTICAL",
                )
            )

        total_sections_count += len(sec_items)
        total_batches_count += len(batch_items)

        course_divisions = sorted(list({item.division for item in sec_items + batch_items if item.division}))
        assigned_types = []
        if sec_items:
            assigned_types.append("THEORY")
        if batch_items:
            assigned_types.append("PRACTICAL")

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
                divisions=course_divisions,
                assigned_types=assigned_types,
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
