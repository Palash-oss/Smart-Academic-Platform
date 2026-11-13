"""
Elective Subject Selection & Onboarding API Routes — Revision FRCRCE-3-26
========================================================================

Student Flow:
  GET   /api/v1/electives/config          — Returns elective courses for Sem 5 & Sem 6
  GET   /api/v1/electives/student-status  — Status of logged-in student (prompts form on login)
  POST  /api/v1/electives/submit          — Submit ranked elective choices for an academic term

Admin / Coordinator Flow:
  GET   /api/v1/electives/admin-progress         — Real-time submission counter & distribution
  POST  /api/v1/electives/run-automated-allotment — Allot students automatically from submitted choices
  POST  /api/v1/electives/deallocate             — De-allocate / reset allotment for re-demoing
  POST  /api/v1/electives/reset-student-choices  — Wipe choices for testing / re-filling from scratch
"""
from __future__ import annotations

import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
import time

# In-memory caches for near-zero latency status lookups
_STUDENT_STATUS_CACHE: Dict[str, tuple[float, Any]] = {}
_COURSE_NAME_CACHE: Dict[str, str] = {}
_ELECTIVE_CONFIG_CACHE: Optional[List[TermElectiveConfig]] = None

def invalidate_student_cache(student_id: Optional[str] = None):
    global _STUDENT_STATUS_CACHE
    if student_id:
        _STUDENT_STATUS_CACHE.pop(student_id, None)
    else:
        _STUDENT_STATUS_CACHE.clear()

from app.api.auth import get_current_user, require_role
from app.db.models import (
    User, Course, CourseOffering, ClassSection, PracticalBatch,
    StudentEnrollment, StudentElectiveChoice, Division, Department
)
from app.db.session import get_db
from app.schemas.allotment import (
    ElectiveSubjectOption,
    ElectiveCategoryGroup,
    TermElectiveConfig,
    ElectiveChoiceSubmissionItem,
    SubmitElectivesRequest,
    StudentChoiceItemRead,
    StudentTermStatus,
    StudentElectiveStatusResponse,
    AdminElectiveProgressResponse,
)
from app.services.allotment_service import AllotmentEngine

router = APIRouter(tags=["Elective Onboarding & Selection"])


# ---------------------------------------------------------------------------
# Helper: Descriptions and friendly names for FrCRCE electives
# ---------------------------------------------------------------------------

ELECTIVE_DESCRIPTIONS = {
    "25PEC13CE11": "Explores decentralized ledgers, consensus algorithms, smart contracts, and Web3 architectures.",
    "25PEC13CE12": "Deep neural architectures, CNNs, RNNs, transformers, and reinforcement learning policy gradients.",
    "25PEC13CE13": "Offensive & defensive security, cryptography protocols, penetration testing, and network defense.",
    "25PEC13CE14": "Distributed data pipelines, Apache Spark, Hadoop ecosystems, and large-scale analytical processing.",
    "25PECL13CE11": "Hands-on lab for image transformation, spatial filtering, feature extraction, and computer vision.",
    "25PECL13CE12": "Practical NLP pipelines: tokenization, POS tagging, NER, word embeddings, and text classification.",
    "25PECL13CE15": "Hands-on penetration testing, Kali Linux, vulnerability assessments, and capture-the-flag exercises.",
    "25PECL13CE13": "Hardware-software integration, sensors, microcontrollers, MQTT protocols, and IoT analytics.",
    "25OE13CE31": "Holistic human development, cognitive psychology, mental resilience, and stress management.",
    "25OE13CE32": "Emotional quotient (EQ), mindfulness, corporate ethics, and spiritual self-awareness.",
    "25PEC13CE21": "Decentralized automated market makers, liquidity pools, tokenomics, and smart contract security.",
    "25PEC13CE22": "Diffusion models, Large Language Models (LLMs), RAG systems, and generative multimodal AI.",
    "25PEC13CE23": "Chain-of-custody procedures, digital evidence recovery, memory analysis, and cyber forensics.",
    "25PECL13CE21": "Graph mining, sentiment analysis, social network analytics, and engagement modeling.",
    "25PECL13CE25": "Interpretable machine learning, SHAP, LIME, saliency maps, and ethical algorithmic auditing.",
    "25OE13CE41": "Strategic stakeholder communication, corporate reputation management, and public relations.",
}


# ===========================================================================
# 1. Config: Get Available Elective Options for 3rd Year (Sem 5 & Sem 6)
# ===========================================================================

@router.get(
    "/v1/electives/config",
    response_model=List[TermElectiveConfig],
    summary="Get configured elective courses for Sem 5 and Sem 6",
)
async def get_elective_config(
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the structured elective baskets for 3rd Year Computer Engineering:
      - Semester 5: PEC-1 (Theory), PECL-1 (Lab), OE-1 (Institute Open Elective)
      - Semester 6: PEC-2 (Theory), PECL-2 (Lab), OE-2 (Institute Open Elective)
    """
    stmt = (
        select(Course)
        .where(
            Course.semester.in_([5, 6]),
            (Course.course_tier.in_(["DEPARTMENT", "INSTITUTE"]))
            | (Course.code.startswith("25PEC"))
            | (Course.code.startswith("25PECL"))
            | (Course.code.startswith("25OE"))
        )
        .order_by(Course.semester, Course.code)
    )
    res = await db.execute(stmt)
    courses = res.scalars().all()

    # Group by semester and category
    by_sem_cat: Dict[int, Dict[str, List[Course]]] = {5: {"PEC": [], "PECL": [], "OE": []}, 6: {"PEC": [], "PECL": [], "OE": []}}
    for c in courses:
        sem = c.semester
        code = c.code.upper()
        if "PECL" in code:
            cat = "PECL"
        elif "PEC" in code:
            cat = "PEC"
        elif "OE" in code:
            cat = "OE"
        else:
            cat = "PEC"
        if sem in by_sem_cat:
            by_sem_cat[sem][cat].append(c)

    configs: List[TermElectiveConfig] = []

    # Semester 5
    sem5_groups = [
        ElectiveCategoryGroup(
            category="PEC",
            category_label="Professional Elective - I (Theory)",
            description="Choose your primary technical specialization (3 Credits · 3 Hrs/Week).",
            min_choices=1,
            max_choices=min(4, len(by_sem_cat[5]["PEC"])),
            options=[
                ElectiveSubjectOption(
                    code=c.code,
                    name=c.name,
                    course_tier=c.course_tier,
                    delivery_mode=c.delivery_mode,
                    th_hours=c.th_hours,
                    pr_hours=c.pr_hours,
                    tu_hours=c.tu_hours,
                    credits=3,
                    description=ELECTIVE_DESCRIPTIONS.get(c.code, ""),
                )
                for c in by_sem_cat[5]["PEC"]
            ],
        ),
        ElectiveCategoryGroup(
            category="PECL",
            category_label="Professional Elective Lab - I (Practical)",
            description="Hands-on laboratory paired with technical electives (1 Credit · 2 Hrs/Week).",
            min_choices=1,
            max_choices=min(4, len(by_sem_cat[5]["PECL"])),
            options=[
                ElectiveSubjectOption(
                    code=c.code,
                    name=c.name,
                    course_tier=c.course_tier,
                    delivery_mode=c.delivery_mode,
                    th_hours=c.th_hours,
                    pr_hours=c.pr_hours,
                    tu_hours=c.tu_hours,
                    credits=1,
                    description=ELECTIVE_DESCRIPTIONS.get(c.code, ""),
                )
                for c in by_sem_cat[5]["PECL"]
            ],
        ),
        ElectiveCategoryGroup(
            category="OE",
            category_label="Open Elective - I (Institute Level)",
            description="Interdisciplinary humanities, psychology, and wellness across branches (3 Credits · 3 Hrs/Week).",
            min_choices=1,
            max_choices=min(2, len(by_sem_cat[5]["OE"])),
            options=[
                ElectiveSubjectOption(
                    code=c.code,
                    name=c.name,
                    course_tier=c.course_tier,
                    delivery_mode=c.delivery_mode,
                    th_hours=c.th_hours,
                    pr_hours=c.pr_hours,
                    tu_hours=c.tu_hours,
                    credits=3,
                    description=ELECTIVE_DESCRIPTIONS.get(c.code, ""),
                )
                for c in by_sem_cat[5]["OE"]
            ],
        ),
    ]

    configs.append(
        TermElectiveConfig(
            academic_term="2026-27-SEM5",
            semester=5,
            semester_label="Semester 5 (Autumn 2026)",
            categories=sem5_groups,
        )
    )

    # Semester 6
    sem6_groups = [
        ElectiveCategoryGroup(
            category="PEC",
            category_label="Professional Elective - II (Theory)",
            description="Advanced domain electives for 6th Semester (3 Credits · 3 Hrs/Week).",
            min_choices=1,
            max_choices=min(3, len(by_sem_cat[6]["PEC"])),
            options=[
                ElectiveSubjectOption(
                    code=c.code,
                    name=c.name,
                    course_tier=c.course_tier,
                    delivery_mode=c.delivery_mode,
                    th_hours=c.th_hours,
                    pr_hours=c.pr_hours,
                    tu_hours=c.tu_hours,
                    credits=3,
                    description=ELECTIVE_DESCRIPTIONS.get(c.code, ""),
                )
                for c in by_sem_cat[6]["PEC"]
            ],
        ),
        ElectiveCategoryGroup(
            category="PECL",
            category_label="Professional Elective Lab - II (Practical)",
            description="Advanced laboratory experiments for 6th Semester (1 Credit · 2 Hrs/Week).",
            min_choices=1,
            max_choices=min(2, len(by_sem_cat[6]["PECL"])),
            options=[
                ElectiveSubjectOption(
                    code=c.code,
                    name=c.name,
                    course_tier=c.course_tier,
                    delivery_mode=c.delivery_mode,
                    th_hours=c.th_hours,
                    pr_hours=c.pr_hours,
                    tu_hours=c.tu_hours,
                    credits=1,
                    description=ELECTIVE_DESCRIPTIONS.get(c.code, ""),
                )
                for c in by_sem_cat[6]["PECL"]
            ],
        ),
        ElectiveCategoryGroup(
            category="OE",
            category_label="Open Elective - II (Institute Level)",
            description="Interdisciplinary communication & public relations (3 Credits · 3 Hrs/Week).",
            min_choices=1,
            max_choices=min(1, len(by_sem_cat[6]["OE"])),
            options=[
                ElectiveSubjectOption(
                    code=c.code,
                    name=c.name,
                    course_tier=c.course_tier,
                    delivery_mode=c.delivery_mode,
                    th_hours=c.th_hours,
                    pr_hours=c.pr_hours,
                    tu_hours=c.tu_hours,
                    credits=3,
                    description=ELECTIVE_DESCRIPTIONS.get(c.code, ""),
                )
                for c in by_sem_cat[6]["OE"]
            ],
        ),
    ]

    configs.append(
        TermElectiveConfig(
            academic_term="2026-27-SEM6",
            semester=6,
            semester_label="Semester 6 (Spring 2027)",
            categories=sem6_groups,
        )
    )

    return configs


# ===========================================================================
# 2. Student Status: Check Form Submission Status on Login
# ===========================================================================

@router.get(
    "/v1/electives/student-status",
    response_model=StudentElectiveStatusResponse,
    summary="Get current student's elective submission and allotment status",
)
async def get_student_elective_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Checks if the logged-in user is a 3rd-year student and whether they
    have submitted their elective preferences for Sem 5 and Sem 6.
    If they haven't submitted Sem 5 preferences, `requires_form_prompt` is True.
    """
    if current_user.role != "STUDENT":
        return StudentElectiveStatusResponse(
            eligible=False,
            requires_form_prompt=False,
            full_name=current_user.full_name,
        )

    user_key = str(current_user.id)
    now_ts = time.time()
    if user_key in _STUDENT_STATUS_CACHE:
        cached_ts, cached_obj = _STUDENT_STATUS_CACHE[user_key]
        if now_ts - cached_ts < 30.0:
            return cached_obj

    # Fetch division & department
    stmt_user = (
        select(User)
        .where(User.id == current_user.id)
        .options(
            selectinload(User.division).selectinload(Division.department),
            selectinload(User.department),
        )
    )
    res_user = await db.execute(stmt_user)
    student = res_user.scalar_one_or_none() or current_user

    div_name = student.division.name if student.division else "A"
    dept_name = (
        student.department.name
        if student.department
        else (student.division.department.name if student.division and student.division.department else "Computer Engineering")
    )
    semester = student.division.semester if student.division else 5

    # Fetch all course codes to resolve friendly names (cached in memory)
    global _COURSE_NAME_CACHE
    if not _COURSE_NAME_CACHE:
        c_stmt = select(Course.code, Course.name)
        c_res = await db.execute(c_stmt)
        _COURSE_NAME_CACHE = {row[0].strip().upper(): row[1] for row in c_res.all()}
    course_name_map = _COURSE_NAME_CACHE

    # Fetch existing elective choices for this student
    ch_stmt = (
        select(StudentElectiveChoice)
        .where(StudentElectiveChoice.student_id == student.id)
        .order_by(StudentElectiveChoice.academic_term, StudentElectiveChoice.category)
    )
    ch_res = await db.execute(ch_stmt)
    choices = ch_res.scalars().all()

    # Check actual enrollments in a SINGLE joined query instead of 4 sequential queries
    enr_stmt = (
        select(StudentEnrollment)
        .where(StudentEnrollment.student_id == student.id)
        .options(
            joinedload(StudentEnrollment.offering).joinedload(CourseOffering.course),
            joinedload(StudentEnrollment.section),
            joinedload(StudentEnrollment.batch),
        )
    )
    enr_res = await db.execute(enr_stmt)
    enrollments = enr_res.unique().scalars().all()

    enr_by_code: Dict[str, StudentEnrollment] = {}
    for enr in enrollments:
        if enr.offering and enr.offering.course:
            enr_by_code[enr.offering.course.code.upper()] = enr

    # Build term status for Sem 5 and Sem 6
    term_configs = [("2026-27-SEM5", 5), ("2026-27-SEM6", 6)]
    term_statuses: List[StudentTermStatus] = []

    has_submitted_sem5 = False

    cat_labels = {
        "PEC": "Professional Elective (Theory)",
        "PECL": "Professional Elective Lab (Practical)",
        "OE": "Open Elective (Institute Level)",
    }

    for term_code, term_sem in term_configs:
        term_choices = [c for c in choices if c.academic_term == term_code]
        submitted = len(term_choices) >= 2  # Has submitted at least PEC and OE
        allotted = any(c.allotted_course_code for c in term_choices) or any(
            enr.offering.academic_term == term_code and (
                enr.offering.course.course_tier in ["DEPARTMENT", "INSTITUTE"]
                or enr.offering.course.code.startswith(("25PEC", "25PECL", "25OE"))
            )
            for enr in enrollments if enr.offering and enr.offering.course
        )

        if term_sem == 5 and submitted:
            has_submitted_sem5 = True

        first_sub_time = term_choices[0].submitted_at.isoformat() if term_choices and term_choices[0].submitted_at else None

        choice_items: List[StudentChoiceItemRead] = []
        for ch in term_choices:
            p1_code = ch.preference_1.upper() if ch.preference_1 else None
            p2_code = ch.preference_2.upper() if ch.preference_2 else None
            p3_code = ch.preference_3.upper() if ch.preference_3 else None
            allot_code = ch.allotted_course_code.upper() if ch.allotted_course_code else None

            enr_record = enr_by_code.get(allot_code) if allot_code else None
            sec_name = enr_record.section.section_name if enr_record and enr_record.section else None
            bat_name = enr_record.batch.batch_name if enr_record and enr_record.batch else None

            choice_items.append(
                StudentChoiceItemRead(
                    category=ch.category,
                    category_label=cat_labels.get(ch.category, ch.category),
                    preference_1=ch.preference_1,
                    preference_1_name=course_name_map.get(p1_code, ch.preference_1),
                    preference_2=ch.preference_2,
                    preference_2_name=course_name_map.get(p2_code, ch.preference_2) if ch.preference_2 else None,
                    preference_3=ch.preference_3,
                    preference_3_name=course_name_map.get(p3_code, ch.preference_3) if ch.preference_3 else None,
                    allotted_course_code=allot_code,
                    allotted_course_name=course_name_map.get(allot_code, allot_code) if allot_code else None,
                    section_name=sec_name,
                    batch_name=bat_name,
                    submitted_at=ch.submitted_at.isoformat() if ch.submitted_at else None,
                )
            )

        term_statuses.append(
            StudentTermStatus(
                academic_term=term_code,
                semester=term_sem,
                submitted=submitted,
                allotted=allotted,
                submitted_at=first_sub_time,
                choices=choice_items,
            )
        )

    # If student is in 3rd year (semester 5) and hasn't submitted Sem 5, require prompt!
    requires_prompt = not has_submitted_sem5

    status_response = StudentElectiveStatusResponse(
        eligible=True,
        student_id=str(student.id),
        student_erp_id=student.student_erp_id,
        full_name=student.full_name,
        roll_no=student.roll_no,
        department_name=dept_name,
        division_name=f"COMP-{div_name}",
        semester=semester,
        requires_form_prompt=requires_prompt,
        terms=term_statuses,
    )

    _STUDENT_STATUS_CACHE[user_key] = (now_ts, status_response)
    return status_response


# ===========================================================================
# 3. Submit Choices: Student submits or updates elective choices
# ===========================================================================

@router.post(
    "/v1/electives/submit",
    summary="Submit or update elective choices for an academic term",
)
async def submit_elective_choices(
    payload: SubmitElectivesRequest,
    current_user: User = Depends(require_role(["STUDENT", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits student's ranked choices for an academic term (e.g. 2026-27-SEM5).
    Upserts into `student_elective_choices` with timestamps.
    """
    if not payload.choices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one elective choice category must be provided.",
        )

    # Verify courses exist in DB
    c_stmt = select(Course.code)
    c_res = await db.execute(c_stmt)
    valid_codes = {row[0].strip().upper() for row in c_res.all()}

    now = datetime.utcnow()
    saved_items = []

    for item in payload.choices:
        cat = item.category.strip().upper()
        p1 = item.preference_1.strip().upper()
        p2 = item.preference_2.strip().upper() if item.preference_2 else None
        p3 = item.preference_3.strip().upper() if item.preference_3 else None

        if p1 not in valid_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid course code '{item.preference_1}' for preference 1 in category {cat}",
            )
        if p2 and p2 not in valid_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid course code '{item.preference_2}' for preference 2 in category {cat}",
            )
        if p3 and p3 not in valid_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid course code '{item.preference_3}' for preference 3 in category {cat}",
            )

        # Check existing choice
        stmt = select(StudentElectiveChoice).where(
            StudentElectiveChoice.student_id == current_user.id,
            StudentElectiveChoice.academic_term == payload.academic_term,
            StudentElectiveChoice.category == cat,
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.preference_1 = p1
            existing.preference_2 = p2
            existing.preference_3 = p3
            existing.submitted_at = now
        else:
            new_choice = StudentElectiveChoice(
                id=uuid.uuid4(),
                student_id=current_user.id,
                academic_term=payload.academic_term,
                category=cat,
                preference_1=p1,
                preference_2=p2,
                preference_3=p3,
                submitted_at=now,
            )
            db.add(new_choice)

        saved_items.append({"category": cat, "preference_1": p1, "preference_2": p2, "preference_3": p3})

    await db.commit()
    invalidate_student_cache(str(current_user.id))

    invalidate_student_cache(student_id)
    return {
        "status": "success",
        "student_id": str(current_user.id),
        "student_name": current_user.full_name,
        "academic_term": payload.academic_term,
        "choices_saved": len(saved_items),
        "message": f"Successfully recorded {len(saved_items)} elective preferences for {payload.academic_term}.",
    }


# ===========================================================================
# 4. Admin Progress: View Real-Time Department Submissions & Distribution
# ===========================================================================

@router.get(
    "/v1/electives/admin-progress",
    response_model=AdminElectiveProgressResponse,
    summary="Admin: Track department elective submission progress & live distribution",
)
async def get_admin_elective_progress(
    academic_term: str = Query("2026-27-SEM5", description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN", "FACULTY"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns real-time statistics for the coordinator:
      - Total eligible 3rd-year students in department
      - Submitted count vs Pending count
      - Distribution count of 1st choices across PEC, PECL, and OE
      - List of pending students who have not yet submitted
    """
    # Fetch all 3rd year students (semester 5 divisions)
    stu_stmt = (
        select(User)
        .join(Division, User.division_id == Division.id, isouter=True)
        .where(User.role == "STUDENT")
        .options(selectinload(User.division))
        .order_by(User.roll_no)
    )
    stu_res = await db.execute(stu_stmt)
    all_students = stu_res.scalars().all()
    total_students = len(all_students)

    # Fetch submitted choices for this term
    ch_stmt = (
        select(StudentElectiveChoice)
        .where(StudentElectiveChoice.academic_term == academic_term)
    )
    ch_res = await db.execute(ch_stmt)
    choices = ch_res.scalars().all()

    submitted_student_ids = {c.student_id for c in choices}
    submitted_count = len(submitted_student_ids)
    pending_count = max(0, total_students - submitted_count)
    percentage = round((submitted_count / total_students * 100), 1) if total_students > 0 else 0.0

    # Check how many are currently allotted
    allotted_student_ids = {c.student_id for c in choices if c.allotted_course_code}
    allotted_count = len(allotted_student_ids)

    # Determine status
    if submitted_count == 0:
        stat = "EMPTY"
    elif allotted_count > 0:
        stat = "ALLOTTED"
    elif submitted_count >= total_students * 0.9:
        stat = "READY_FOR_ALLOTMENT"
    else:
        stat = "COLLECTING"

    # Category breakdown for 1st preference
    category_distribution: Dict[str, Dict[str, int]] = {}
    for c in choices:
        cat = c.category
        if cat not in category_distribution:
            category_distribution[cat] = {}
        p1 = c.preference_1.upper()
        category_distribution[cat][p1] = category_distribution[cat].get(p1, 0) + 1

    # Pending students list
    pending_students = []
    for s in all_students:
        if s.id not in submitted_student_ids:
            pending_students.append({
                "student_id": str(s.id),
                "erp_id": s.student_erp_id,
                "roll_no": s.roll_no or "-",
                "name": s.full_name,
                "division": f"COMP-{s.division.name}" if s.division else "COMP",
                "email": s.email,
            })

    return AdminElectiveProgressResponse(
        academic_term=academic_term,
        total_eligible_students=total_students,
        submitted_students_count=submitted_count,
        pending_students_count=pending_count,
        submission_percentage=percentage,
        status=stat,
        category_distribution=category_distribution,
        pending_students=pending_students,
        allotted_students_count=allotted_count,
    )


# ===========================================================================
# 5. Admin Trigger: Run Automated Allotment from Database Choices
# ===========================================================================

@router.post(
    "/v1/electives/run-automated-allotment",
    summary="Admin: Run the Automated Allotment Engine on submitted form choices",
)
async def run_automated_allotment(
    academic_term: str = Query("2026-27-SEM5", description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes the Allotment Engine directly on the student choices in the database:
      1. Applies First-Come-First-Serve preference resolution & Min 20 threshold
      2. Creates balanced theory sections and practical batches
      3. Automatically assigns qualified professors
      4. Auto-enrolls core mandatory courses
      5. Updates student choice records with their allotted subjects
    """
    engine = AllotmentEngine(db)
    try:
        summary = await engine.run_allotment_from_db_preferences(academic_term)
        invalidate_student_cache()
        return {
            "status": "success",
            "academic_term": academic_term,
            "message": f"Automated allotment for {academic_term} completed successfully!",
            "sections_created": summary.get("sections_created", 0),
            "batches_created": summary.get("batches_created", 0),
            "faculty_slots_generated": summary.get("faculty_slots_generated", 0),
            "core_courses_enrolled": summary.get("core_enrolled", 0),
            "notices": summary.get("notices", []),
            "errors": summary.get("errors", []),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allotment execution failed: {str(e)}",
        )


# ===========================================================================
# 6. Admin Action: De-Allocate / Reset Allotment for Live Demos
# ===========================================================================

@router.post(
    "/v1/electives/deallocate",
    summary="Admin: De-allocate / Reset elective allotments (Preserves student choices for demos)",
)
async def deallocate_electives(
    academic_term: str = Query("2026-27-SEM5", description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Clears generated elective enrollments, class sections, and practical batches.
    Resets student choices back to 'Unallotted'.
    Student form submissions remain 100% preserved so the demo can be re-run instantly!
    """
    engine = AllotmentEngine(db)
    result = await engine.deallocate_electives_for_term(academic_term)
    invalidate_student_cache()
    return result


# ===========================================================================
# 7. Demo Helper: Reset Student Choices
# ===========================================================================

@router.post(
    "/v1/electives/reset-student-choices",
    summary="Admin / Demo: Reset student form choices to demo the form from scratch",
)
async def reset_student_choices(
    academic_term: str = Query("2026-27-SEM5", description="e.g. '2026-27-SEM5'"),
    student_id: Optional[str] = Query(None, description="Optional UUID to reset single student"),
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Clears rows from `student_elective_choices`. If student_id is omitted,
    wipes choices for all students for that term, allowing a complete live demonstration
    of students submitting the Google-Form style elective form from scratch!
    """
    # First de-allocate any running allotments for this term
    engine = AllotmentEngine(db)
    await engine.deallocate_electives_for_term(academic_term)

    # Delete choices
    stmt = delete(StudentElectiveChoice).where(StudentElectiveChoice.academic_term == academic_term)
    if student_id:
        stmt = stmt.where(StudentElectiveChoice.student_id == uuid.UUID(student_id))

    del_res = await db.execute(stmt)
    await db.commit()
    invalidate_student_cache(str(current_user.id))

    invalidate_student_cache(student_id)
    return {
        "status": "success",
        "academic_term": academic_term,
        "choices_cleared": del_res.rowcount or 0,
        "message": f"Choices cleared for {academic_term}. Students will now be prompted with the elective form upon login.",
    }


# ===========================================================================
# 8. Live Demo Preset: Seed Background Cohort, Leave 4 Testers (Palash, Manav, Shonit, Saad) Pending
# ===========================================================================

@router.post(
    "/v1/electives/demo-prep-live",
    summary="Admin / Demo: Seed background cohort, leave 4 testers (Palash, Manav, Shonit, Saad) unsubmitted, de-allocate all",
)
async def demo_prep_live(
    academic_term: str = Query("2026-27-SEM5", description="e.g. '2026-27-SEM5'"),
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Sets up the system for the live presentation demo:
      1. De-allocates all active elective enrollments (allotment count becomes 0).
      2. Completely wipes choices for the 4 live interactive testers (Palash, Manav, Shonit, Saad).
      3. Ensures all other background students have submitted form choices with realistic distributions.
      4. Results in: ~137 Submitted, 4 Pending (Palash, Manav, Shonit, Saad), 0 Allotted.
    """
    engine = AllotmentEngine(db)
    await engine.deallocate_electives_for_term(academic_term)

    # 2. Identify the 4 live anchor testers
    stu_stmt = select(User).where(
        User.role == "STUDENT",
        (User.full_name.ilike("%Palash%"))
        | (User.email == "crce.10265.ceb@gmail.com")
        | (User.full_name.ilike("%Manav%"))
        | (User.email == "crce.10279.ceb@gmail.com")
        | (User.full_name.ilike("%Shonit%"))
        | (User.email == "crce.10277.ceb@gmail.com")
        | (User.full_name.ilike("%Saad%"))
        | (User.email == "crce.10468.ceb@gmail.com")
    )
    res_stu = await db.execute(stu_stmt)
    tester_students = res_stu.scalars().all()
    tester_ids = {s.id for s in tester_students}

    # 3. Wipe choices for the 4 testers
    if tester_ids:
        await db.execute(
            delete(StudentElectiveChoice).where(
                StudentElectiveChoice.student_id.in_(tester_ids),
                StudentElectiveChoice.academic_term == academic_term,
            )
        )

    # 4. Verify all OTHER students have submitted choices
    all_stu_stmt = (
        select(User)
        .where(User.role == "STUDENT", ~User.id.in_(tester_ids))
    )
    all_res = await db.execute(all_stu_stmt)
    other_students = all_res.scalars().all()

    pec_baskets = [
        ("25PEC13CE13", "25PEC13CE12", "25PEC13CE11"),
        ("25PEC13CE12", "25PEC13CE14", "25PEC13CE13"),
        ("25PEC13CE11", "25PEC13CE13", "25PEC13CE12"),
        ("25PEC13CE14", "25PEC13CE12", "25PEC13CE11"),
    ]
    pecl_baskets = [
        ("25PECL13CE15", "25PECL13CE12", "25PECL13CE11"),
        ("25PECL13CE12", "25PECL13CE13", "25PECL13CE15"),
        ("25PECL13CE11", "25PECL13CE15", "25PECL13CE12"),
        ("25PECL13CE13", "25PECL13CE11", "25PECL13CE15"),
    ]
    oe_baskets = [
        ("25OE13CE31", "25OE13CE32", None),
        ("25OE13CE32", "25OE13CE31", None),
    ]

    existing_ch_stmt = (
        select(StudentElectiveChoice.student_id)
        .where(StudentElectiveChoice.academic_term == academic_term)
    )
    existing_res = await db.execute(existing_ch_stmt)
    students_with_choices = {row[0] for row in existing_res.all()}

    now = datetime.utcnow()
    for idx, student in enumerate(other_students):
        if student.id not in students_with_choices:
            pec = pec_baskets[idx % len(pec_baskets)]
            pecl = pecl_baskets[idx % len(pecl_baskets)]
            oe = oe_baskets[idx % len(oe_baskets)]

            db.add(StudentElectiveChoice(
                id=uuid.uuid4(),
                student_id=student.id,
                academic_term=academic_term,
                category="PEC",
                preference_1=pec[0],
                preference_2=pec[1],
                preference_3=pec[2],
                submitted_at=now,
            ))
            db.add(StudentElectiveChoice(
                id=uuid.uuid4(),
                student_id=student.id,
                academic_term=academic_term,
                category="PECL",
                preference_1=pecl[0],
                preference_2=pecl[1],
                preference_3=pecl[2],
                submitted_at=now,
            ))
            db.add(StudentElectiveChoice(
                id=uuid.uuid4(),
                student_id=student.id,
                academic_term=academic_term,
                category="OE",
                preference_1=oe[0],
                preference_2=oe[1],
                preference_3=oe[2],
                submitted_at=now,
            ))

    await db.commit()
    invalidate_student_cache()

    tester_names = [s.full_name for s in tester_students]

    return {
        "status": "success",
        "academic_term": academic_term,
        "message": f"Live demo mode ready! {len(other_students)} student forms are submitted. 4 Testers are PENDING: {', '.join(tester_names)}. Allotments are de-allocated (0 enrolled).",
        "total_eligible_students": len(other_students) + len(tester_students),
        "submitted_students_count": len(other_students),
        "pending_testers": tester_names,
        "allotted_count": 0,
    }

