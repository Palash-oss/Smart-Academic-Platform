"""
Service for Exam Cell, Assessment Templates, Marks Gradebook, Locking, and OBE Attainment.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Course,
    CourseOffering,
    CourseOutcome,
    CourseCOPOMapping,
    ExamEvaluationTemplate,
    ExamComponent,
    ExamSubComponent,
    StudentMarksRecord,
    ExamLockPeriod,
    ExamUnlockRequest,
    MarksAuditLog,
    StudentEnrollment,
    FacultyCourseDivision,
    User,
    ClassSection,
    PracticalBatch,
    TimetableSlot,
)
from app.schemas.exam import (
    CourseOutcomeOut,
    ExamComponentOut,
    ExamSubComponentOut,
    ExamTemplateOut,
    ExamTemplateIn,
    GradebookResponse,
    GradebookStudentRow,
    BatchMarksSavePayload,
    COAttainmentItem,
    POAttainmentItem,
    OBEAttainmentResponse,
    StudentCourseGradeSummary,
    UnlockRequestOut,
)


class ExamServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class ExamService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _is_expired(self, deadline: Optional[datetime]) -> bool:
        """Safely compare deadline with current UTC time without timezone mismatch errors."""
        if not deadline:
            return False
        if deadline.tzinfo is not None:
            return datetime.now(timezone.utc) > deadline
        return datetime.utcnow() > deadline

    # ------------------------------------------------------------------ Courses Hub
    async def list_faculty_offerings(self, faculty_user: User) -> List[Dict]:
        """List course offerings assigned to this faculty member with exam completion status."""
        # 1. Collect all offering IDs assigned to this faculty across timetable slots, sections, and batches
        assigned_offering_ids = set()

        # From TimetableSlot
        ts_stmt = select(TimetableSlot.offering_id).where(
            TimetableSlot.faculty_id == faculty_user.id,
            TimetableSlot.offering_id.isnot(None)
        )
        for off_id in (await self.db.execute(ts_stmt)).scalars().all():
            if off_id:
                assigned_offering_ids.add(off_id)

        # From ClassSection
        cs_stmt = select(ClassSection.offering_id).where(
            ClassSection.faculty_id == faculty_user.id,
            ClassSection.offering_id.isnot(None)
        )
        for off_id in (await self.db.execute(cs_stmt)).scalars().all():
            if off_id:
                assigned_offering_ids.add(off_id)

        # From PracticalBatch
        pb_stmt = select(PracticalBatch.offering_id).where(
            PracticalBatch.faculty_id == faculty_user.id,
            PracticalBatch.offering_id.isnot(None)
        )
        for off_id in (await self.db.execute(pb_stmt)).scalars().all():
            if off_id:
                assigned_offering_ids.add(off_id)

        # From FacultyCourseDivision
        fcd_stmt = select(FacultyCourseDivision.course_id).where(
            FacultyCourseDivision.faculty_id == faculty_user.id
        )
        fcd_course_ids = set((await self.db.execute(fcd_stmt)).scalars().all())

        # If faculty has specific assigned offerings, strictly show ONLY their allocated offerings!
        # If user is ADMIN with 0 specific allocations (e.g., pure admin), allow viewing all offerings.
        has_assignments = bool(assigned_offering_ids or fcd_course_ids)

        stmt = (
            select(CourseOffering)
            .join(Course, CourseOffering.course_id == Course.id)
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.enrollments),
            )
            .order_by(Course.code)
        )
        all_offerings = (await self.db.execute(stmt)).scalars().all()

        target_offerings = []
        for off in all_offerings:
            if has_assignments:
                if off.id in assigned_offering_ids or off.course_id in fcd_course_ids:
                    target_offerings.append(off)
            elif faculty_user.role == "ADMIN":
                target_offerings.append(off)

        if not target_offerings:
            return []

        target_off_ids = [off.id for off in target_offerings]

        # Batch load templates and lock periods in 2 fast queries
        tmpl_stmt = select(ExamEvaluationTemplate).where(ExamEvaluationTemplate.offering_id.in_(target_off_ids))
        templates = (await self.db.execute(tmpl_stmt)).scalars().all()
        tmpl_map = {t.offering_id: t for t in templates}

        lock_stmt = select(ExamLockPeriod).where(ExamLockPeriod.offering_id.in_(target_off_ids))
        locks = (await self.db.execute(lock_stmt)).scalars().all()
        lock_map: Dict[uuid.UUID, List[ExamLockPeriod]] = {}
        for l in locks:
            lock_map.setdefault(l.offering_id, []).append(l)

        faculty_courses = []
        for off in target_offerings:
            tmpl = tmpl_map.get(off.id)
            off_locks = lock_map.get(off.id, [])
            is_locked = any(l.is_locked or self._is_expired(l.submission_deadline) for l in off_locks) if off_locks else False

            faculty_courses.append({
                "offering_id": str(off.id),
                "course_id": str(off.course_id),
                "course_code": off.course.code,
                "course_name": off.course.name,
                "semester": off.course.semester,
                "academic_term": off.academic_term,
                "delivery_mode": off.course.delivery_mode,
                "student_count": len(off.enrollments),
                "has_template": tmpl is not None,
                "template_status": tmpl.status if tmpl else "PENDING",
                "is_locked": is_locked,
            })

        return faculty_courses

    # ------------------------------------------------------------------ Assessment Template
    async def get_or_create_template(self, offering_id: uuid.UUID, faculty_user: User) -> ExamTemplateOut:
        """Fetch course assessment blueprint, or create a syllabus-compliant default if none exists."""
        offering = await self.db.get(CourseOffering, offering_id)
        if not offering:
            raise ExamServiceError("Course offering not found.", 404)
        course = await self.db.get(Course, offering.course_id)

        # Load syllabus COs
        cos_stmt = (
            select(CourseOutcome)
            .where(CourseOutcome.course_id == course.id)
            .order_by(CourseOutcome.co_code)
        )
        cos = (await self.db.execute(cos_stmt)).scalars().all()
        if cos:
            cos_out = [
                CourseOutcomeOut(
                    id=str(c.id),
                    co_code=c.co_code,
                    description=c.description,
                    bloom_level=c.bloom_level,
                )
                for c in cos
            ]
        else:
            # Autonomous syllabus fallback: standard CO1 to CO6
            standard_cos = [
                ("CO1", "Understand and recall fundamental principles, core models, and concepts.", "L1_REMEMBER"),
                ("CO2", "Apply theoretical concepts to formulate and solve engineering problems.", "L3_APPLY"),
                ("CO3", "Analyze and evaluate computational architectures, algorithms, and systems.", "L4_ANALYZE"),
                ("CO4", "Design and formulate solutions meeting realistic socio-technical constraints.", "L6_CREATE"),
                ("CO5", "Evaluate system performance, security trade-offs, and design alternatives.", "L5_EVALUATE"),
                ("CO6", "Implement practical solutions using modern engineering tools and frameworks.", "L3_APPLY"),
            ]
            cos_out = [
                CourseOutcomeOut(
                    id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{course.id}-{code}")),
                    co_code=code,
                    description=desc,
                    bloom_level=bloom,
                )
                for code, desc, bloom in standard_cos
            ]
        co_codes = [c.co_code for c in cos_out]

        # Check existing template
        tmpl_stmt = (
            select(ExamEvaluationTemplate)
            .where(ExamEvaluationTemplate.offering_id == offering_id)
            .options(
                selectinload(ExamEvaluationTemplate.components)
                .selectinload(ExamComponent.sub_components)
            )
        )
        tmpl = (await self.db.execute(tmpl_stmt)).scalars().first()

        # If existing template for theory is missing ESE, dynamically add ESE
        if tmpl and course.delivery_mode in ("INTEGRATED_TH_PR", "THEORY_TUTORIAL", "THEORY_ONLY"):
            existing_types = set(
                (await self.db.execute(
                    select(ExamComponent.component_type).where(ExamComponent.template_id == tmpl.id)
                )).scalars().all()
            )
            if "THEORY_ESE" not in existing_types:
                ese = ExamComponent(
                    template_id=tmpl.id,
                    component_type="THEORY_ESE",
                    display_name="End-Semester Examination (ESE)",
                    max_marks=50.0,
                    passing_marks=20.0,
                    weight_percentage=50.0,
                    formula_type="SUM",
                    order_index=3,
                )
                self.db.add(ese)
                await self.db.flush()
                self.db.add_all([
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q1: Compulsory Comprehensive (Modules 1-2)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[0], co_codes[1]] if len(co_codes) > 1 else [co_codes[0]],
                        order_index=1,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q2: Analytical Problem (Module 3)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[2]] if len(co_codes) > 2 else [co_codes[0]],
                        order_index=2,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q3: System Design / Problem (Module 4)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[3]] if len(co_codes) > 3 else [co_codes[0]],
                        order_index=3,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q4: Applied Case Study (Module 5)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[4]] if len(co_codes) > 4 else [co_codes[0]],
                        order_index=4,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q5: Advanced Formulation (Module 6)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[min(5, len(co_codes) - 1)]],
                        order_index=5,
                    ),
                ])
                await self.db.commit()
                tmpl = (await self.db.execute(tmpl_stmt)).scalars().first()

        if not tmpl:
            # Create default based on delivery_mode
            tmpl = ExamEvaluationTemplate(
                offering_id=offering_id,
                faculty_id=faculty_user.id,
                academic_term=offering.academic_term,
                title=f"{course.code} Evaluation Blueprint (FRCRCE-3-26)",
                status="ACTIVE",
            )
            self.db.add(tmpl)
            await self.db.flush()

            if course.delivery_mode in ("INTEGRATED_TH_PR", "THEORY_TUTORIAL", "THEORY_ONLY"):
                # Component 1: Theory ISE (20 Marks)
                ise = ExamComponent(
                    template_id=tmpl.id,
                    component_type="THEORY_ISE",
                    display_name="In-Semester Evaluation (ISE)",
                    max_marks=20.0,
                    passing_marks=8.0,
                    weight_percentage=20.0,
                    formula_type="SUM",
                    order_index=1,
                )
                self.db.add(ise)
                await self.db.flush()
                self.db.add_all([
                    ExamSubComponent(
                        component_id=ise.id,
                        title="Formative Activity / Assignment",
                        sub_type="ACTIVITY",
                        max_marks=10.0,
                        mapped_cos=[co_codes[0]] if len(co_codes) > 0 else ["CO1"],
                        order_index=1,
                    ),
                    ExamSubComponent(
                        component_id=ise.id,
                        title="Class Unit Test 1",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[1]] if len(co_codes) > 1 else ["CO2"],
                        order_index=2,
                    ),
                ])

                # Component 2: Theory MSE (30 Marks)
                mse = ExamComponent(
                    template_id=tmpl.id,
                    component_type="THEORY_MSE",
                    display_name="Mid-Semester Examination (MSE)",
                    max_marks=30.0,
                    passing_marks=12.0,
                    weight_percentage=30.0,
                    formula_type="SUM",
                    order_index=2,
                )
                self.db.add(mse)
                await self.db.flush()
                self.db.add_all([
                    ExamSubComponent(
                        component_id=mse.id,
                        title="Q1: Concepts & Core Foundations",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[0]] if len(co_codes) > 0 else ["CO1"],
                        order_index=1,
                    ),
                    ExamSubComponent(
                        component_id=mse.id,
                        title="Q2: Analytical & Applied Problem",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[1]] if len(co_codes) > 1 else ["CO2"],
                        order_index=2,
                    ),
                    ExamSubComponent(
                        component_id=mse.id,
                        title="Q3: Design & Evaluation",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[2]] if len(co_codes) > 2 else ["CO3"],
                        order_index=3,
                    ),
                ])

                # Component 3: Theory ESE (50 Marks)
                ese = ExamComponent(
                    template_id=tmpl.id,
                    component_type="THEORY_ESE",
                    display_name="End-Semester Examination (ESE)",
                    max_marks=50.0,
                    passing_marks=20.0,
                    weight_percentage=50.0,
                    formula_type="SUM",
                    order_index=3,
                )
                self.db.add(ese)
                await self.db.flush()
                self.db.add_all([
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q1: Compulsory Comprehensive (Modules 1-2)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[0], co_codes[1]] if len(co_codes) > 1 else [co_codes[0]],
                        order_index=1,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q2: Analytical Problem (Module 3)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[2]] if len(co_codes) > 2 else [co_codes[0]],
                        order_index=2,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q3: System Design / Problem (Module 4)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[3]] if len(co_codes) > 3 else [co_codes[0]],
                        order_index=3,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q4: Applied Case Study (Module 5)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[4]] if len(co_codes) > 4 else [co_codes[0]],
                        order_index=4,
                    ),
                    ExamSubComponent(
                        component_id=ese.id,
                        title="Q5: Advanced Formulation (Module 6)",
                        sub_type="TEST",
                        max_marks=10.0,
                        mapped_cos=[co_codes[min(5, len(co_codes) - 1)]],
                        order_index=5,
                    ),
                ])

            if course.delivery_mode == "INTEGRATED_TH_PR":
                # Component 4: Lab ISE (50 Marks)
                lab = ExamComponent(
                    template_id=tmpl.id,
                    component_type="LAB_ISE",
                    display_name="Laboratory Continuous Assessment & Oral",
                    max_marks=50.0,
                    passing_marks=20.0,
                    weight_percentage=50.0,
                    formula_type="SUM",
                    order_index=4,
                )
                self.db.add(lab)
                await self.db.flush()
                self.db.add_all([
                    ExamSubComponent(
                        component_id=lab.id,
                        title="Lab Experiments Performance & Continuous Submission",
                        sub_type="EXPERIMENT",
                        max_marks=25.0,
                        mapped_cos=co_codes[:3],
                        order_index=1,
                    ),
                    ExamSubComponent(
                        component_id=lab.id,
                        title="Oral & Practical Examination",
                        sub_type="TEST",
                        max_marks=25.0,
                        mapped_cos=co_codes[3:] or co_codes,
                        order_index=2,
                    ),
                ])

            elif course.delivery_mode == "THEORY_TUTORIAL":
                # Tutorial ISE (50 Marks = 5 x 10)
                tut = ExamComponent(
                    template_id=tmpl.id,
                    component_type="TUT_ISE",
                    display_name="Continuous Tutorial Evaluation (5 Tutorials)",
                    max_marks=50.0,
                    passing_marks=20.0,
                    weight_percentage=50.0,
                    formula_type="SUM",
                    order_index=4,
                )
                self.db.add(tut)
                await self.db.flush()
                for i in range(1, 6):
                    self.db.add(
                        ExamSubComponent(
                            component_id=tut.id,
                            title=f"Tutorial {i} Assessment",
                            sub_type="TUTORIAL",
                            max_marks=10.0,
                            mapped_cos=[co_codes[min(i - 1, len(co_codes) - 1)]],
                            order_index=i,
                        )
                    )

            elif course.delivery_mode == "PRACTICAL_ONLY":
                # Pure Lab (100 or 50 Marks)
                pure_lab = ExamComponent(
                    template_id=tmpl.id,
                    component_type="LAB_ISE",
                    display_name="Laboratory ISE & Oral",
                    max_marks=100.0,
                    passing_marks=40.0,
                    weight_percentage=100.0,
                    formula_type="SUM",
                    order_index=1,
                )
                self.db.add(pure_lab)
                await self.db.flush()
                self.db.add_all([
                    ExamSubComponent(
                        component_id=pure_lab.id,
                        title="Experiments Continuous Performance (50M)",
                        sub_type="EXPERIMENT",
                        max_marks=50.0,
                        mapped_cos=co_codes[:3],
                        order_index=1,
                    ),
                    ExamSubComponent(
                        component_id=pure_lab.id,
                        title="Oral & Mini Project Demonstration (50M)",
                        sub_type="TEST",
                        max_marks=50.0,
                        mapped_cos=co_codes[3:] or co_codes,
                        order_index=2,
                    ),
                ])

            # Default 14-day lock deadline from today
            deadline = datetime.now(timezone.utc) + timedelta(days=14)
            for c_type in ("THEORY_ISE", "THEORY_MSE", "THEORY_ESE", "LAB_ISE", "TUT_ISE"):
                self.db.add(
                    ExamLockPeriod(
                        offering_id=offering_id,
                        component_type=c_type,
                        submission_deadline=deadline,
                        is_locked=False,
                    )
                )

            await self.db.commit()

            # Re-query cleanly with loaded relationships
            tmpl = (await self.db.execute(tmpl_stmt)).scalars().first()

        # Format output
        components_out = []
        seen_c_ids = set()
        for c in tmpl.components:
            if c.id in seen_c_ids:
                continue
            seen_c_ids.add(c.id)
            subs_out = [
                ExamSubComponentOut(
                    id=str(s.id),
                    component_id=str(s.component_id),
                    title=s.title,
                    sub_type=s.sub_type,
                    max_marks=s.max_marks,
                    mapped_cos=s.mapped_cos or [],
                    order_index=s.order_index,
                )
                for s in c.sub_components
            ]
            components_out.append(
                ExamComponentOut(
                    id=str(c.id),
                    template_id=str(c.template_id),
                    component_type=c.component_type,
                    display_name=c.display_name,
                    max_marks=c.max_marks,
                    passing_marks=c.passing_marks,
                    weight_percentage=c.weight_percentage,
                    formula_type=c.formula_type,
                    order_index=c.order_index,
                    sub_components=subs_out,
                )
            )

        return ExamTemplateOut(
            id=str(tmpl.id),
            offering_id=str(tmpl.offering_id),
            course_code=course.code,
            course_name=course.name,
            academic_term=tmpl.academic_term,
            title=tmpl.title,
            status=tmpl.status,
            available_cos=cos_out,
            components=components_out,
        )

    async def update_template(
        self, offering_id: uuid.UUID, faculty_user: User, data: ExamTemplateIn
    ) -> ExamTemplateOut:
        """Allows faculty to update components, divide ISE marks, and change CO mappings."""
        # Check lock
        is_locked, _ = await self._is_offering_locked(offering_id, "ALL")
        if is_locked and faculty_user.role != "ADMIN":
            raise ExamServiceError("Assessment template is locked. Submit an unlock request to make modifications.", 403)

        tmpl_stmt = (
            select(ExamEvaluationTemplate)
            .where(ExamEvaluationTemplate.offering_id == offering_id)
            .options(selectinload(ExamEvaluationTemplate.components).selectinload(ExamComponent.sub_components))
        )
        tmpl = (await self.db.execute(tmpl_stmt)).scalars().first()
        if not tmpl:
            raise ExamServiceError("Template not found.", 404)

        tmpl.title = data.title
        tmpl.updated_at = datetime.utcnow()

        # Update or recreate components
        # Remove old components cleanly
        for c in list(tmpl.components):
            await self.db.delete(c)
        await self.db.flush()

        for comp_idx, c_in in enumerate(data.components, start=1):
            comp = ExamComponent(
                template_id=tmpl.id,
                component_type=c_in.component_type,
                display_name=c_in.display_name,
                max_marks=c_in.max_marks,
                passing_marks=c_in.passing_marks,
                weight_percentage=c_in.weight_percentage,
                formula_type=c_in.formula_type,
                order_index=comp_idx,
            )
            self.db.add(comp)
            await self.db.flush()

            for sub_idx, s_in in enumerate(c_in.sub_components, start=1):
                sub = ExamSubComponent(
                    component_id=comp.id,
                    title=s_in.title,
                    sub_type=s_in.sub_type,
                    max_marks=s_in.max_marks,
                    mapped_cos=s_in.mapped_cos,
                    order_index=sub_idx,
                )
                self.db.add(sub)

        await self.db.commit()
        return await self.get_or_create_template(offering_id, faculty_user)

    # ------------------------------------------------------------------ Gradebook
    async def get_gradebook(self, offering_id: uuid.UUID, user: User) -> GradebookResponse:
        """Return full spreadsheet roster of students, columns, and current marks."""
        offering = await self.db.get(CourseOffering, offering_id)
        if not offering:
            raise ExamServiceError("Course offering not found.", 404)
        course = await self.db.get(Course, offering.course_id)

        template_out = await self.get_or_create_template(offering_id, user)

        # Fetch enrolled students
        enroll_stmt = (
            select(StudentEnrollment)
            .where(StudentEnrollment.offering_id == offering_id)
            .options(
                selectinload(StudentEnrollment.student),
                selectinload(StudentEnrollment.section),
                selectinload(StudentEnrollment.batch),
            )
            .order_by(StudentEnrollment.student_id)
        )
        enrollments = (await self.db.execute(enroll_stmt)).scalars().all()

        # Fetch existing marks
        marks_stmt = (
            select(StudentMarksRecord)
            .where(StudentMarksRecord.offering_id == offering_id)
        )
        marks_records = (await self.db.execute(marks_stmt)).scalars().all()
        marks_map: Dict[Tuple[uuid.UUID, uuid.UUID], StudentMarksRecord] = {
            (m.student_id, m.sub_component_id): m for m in marks_records
        }

        # Check lock status
        is_locked, deadline = await self._is_offering_locked(offering_id, "THEORY_ISE")
        status_label = "LOCKED" if is_locked else ("OPEN" if not self._is_expired(deadline) else "EXPIRED")
        can_edit = not is_locked or user.role == "ADMIN"

        student_rows: List[GradebookStudentRow] = []
        for enr in enrollments:
            st = enr.student
            if not st:
                continue

            scores: Dict[str, float] = {}
            absents: Dict[str, bool] = {}
            comp_totals: Dict[str, float] = {}

            for comp in template_out.components:
                c_total = 0.0
                for sub in comp.sub_components:
                    sub_uuid = uuid.UUID(sub.id)
                    rec = marks_map.get((st.id, sub_uuid))
                    if rec:
                        scores[sub.id] = rec.marks_obtained
                        absents[sub.id] = rec.is_absent
                        if not rec.is_absent:
                            c_total += rec.marks_obtained
                    else:
                        scores[sub.id] = 0.0
                        absents[sub.id] = False

                comp_totals[comp.component_type] = round(c_total, 2)

            div_name = enr.section.section_name if enr.section else "A"
            b_name = enr.batch.batch_name if enr.batch else None

            student_rows.append(
                GradebookStudentRow(
                    student_id=str(st.id),
                    roll_no=st.roll_no or "N/A",
                    erp_id=st.student_erp_id,
                    full_name=st.full_name,
                    division_name=div_name,
                    batch_name=b_name,
                    scores=scores,
                    absents=absents,
                    component_totals=comp_totals,
                )
            )

        # Sort by roll_no
        student_rows.sort(key=lambda s: (s.division_name, s.roll_no))

        return GradebookResponse(
            offering_id=str(offering_id),
            course_code=course.code,
            course_name=course.name,
            academic_term=offering.academic_term,
            is_locked=is_locked,
            deadline=deadline,
            lock_status_label=status_label,
            can_edit=can_edit,
            columns=template_out.components,
            students=student_rows,
        )

    # ------------------------------------------------------------------ Marks Entry
    async def save_batch_marks(
        self, offering_id: uuid.UUID, faculty_user: User, payload: BatchMarksSavePayload
    ) -> Dict:
        """Batch save / update marks from keyboard spreadsheet or bulk upload."""
        is_locked, _ = await self._is_offering_locked(offering_id, payload.component_type)
        if is_locked and faculty_user.role != "ADMIN":
            # Check if there is an active unlock request
            unlocked = await self._has_active_unlock(offering_id, payload.component_type)
            if not unlocked:
                raise ExamServiceError("Marks entry for this component is locked. Submit an unlock request.", 403)

        updated_count = 0
        for item in payload.updates:
            s_id = uuid.UUID(str(item["student_id"]))
            sub_id = uuid.UUID(str(item["sub_component_id"]))
            score = float(item.get("marks", 0.0))
            is_abs = bool(item.get("is_absent", False))
            remarks = str(item.get("remarks", "")) if item.get("remarks") else None

            sub_comp = await self.db.get(ExamSubComponent, sub_id)
            if not sub_comp:
                continue

            # Validate max marks
            if score > sub_comp.max_marks:
                raise ExamServiceError(
                    f"Score {score} exceeds maximum allowed ({sub_comp.max_marks}) for {sub_comp.title}."
                )

            # Upsert
            existing_stmt = select(StudentMarksRecord).where(
                StudentMarksRecord.sub_component_id == sub_id,
                StudentMarksRecord.student_id == s_id,
            )
            existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()

            if existing:
                # Log audit if changed
                if existing.marks_obtained != score or existing.is_absent != is_abs:
                    self.db.add(
                        MarksAuditLog(
                            student_marks_id=existing.id,
                            old_marks=existing.marks_obtained,
                            new_marks=score,
                            old_is_absent=existing.is_absent,
                            new_is_absent=is_abs,
                            changed_by_user_id=faculty_user.id,
                            reason=payload.change_reason or "Faculty spreadsheet edit",
                        )
                    )
                existing.marks_obtained = score
                existing.is_absent = is_abs
                existing.remarks = remarks
                existing.updated_at = datetime.utcnow()
                existing.entered_by_faculty_id = faculty_user.id
            else:
                new_rec = StudentMarksRecord(
                    offering_id=offering_id,
                    sub_component_id=sub_id,
                    student_id=s_id,
                    marks_obtained=score,
                    is_absent=is_abs,
                    remarks=remarks,
                    entered_by_faculty_id=faculty_user.id,
                )
                self.db.add(new_rec)

            updated_count += 1

        await self.db.commit()
        return {"status": "success", "updated_records": updated_count}

    # ------------------------------------------------------------------ Lock & Unlock
    async def _is_offering_locked(self, offering_id: uuid.UUID, component_type: str) -> Tuple[bool, Optional[datetime]]:
        stmt = select(ExamLockPeriod).where(
            ExamLockPeriod.offering_id == offering_id,
            or_(ExamLockPeriod.component_type == component_type, ExamLockPeriod.component_type == "ALL")
        )
        locks = (await self.db.execute(stmt)).scalars().all()
        for l in locks:
            if l.is_locked:
                return True, l.submission_deadline
            if self._is_expired(l.submission_deadline):
                return True, l.submission_deadline
        return False, locks[0].submission_deadline if locks else None

    async def _has_active_unlock(self, offering_id: uuid.UUID, component_type: str) -> bool:
        stmt = select(ExamUnlockRequest).where(
            ExamUnlockRequest.offering_id == offering_id,
            ExamUnlockRequest.component_type == component_type,
            ExamUnlockRequest.status == "APPROVED",
        )
        reqs = (await self.db.execute(stmt)).scalars().all()
        for req in reqs:
            if req.unlock_expires_at and not self._is_expired(req.unlock_expires_at):
                return True
        return False

    async def lock_marks(self, offering_id: uuid.UUID, faculty_user: User, component_type: str = "ALL") -> Dict:
        """Lock marks after evaluation review."""
        now_dt = datetime.now(timezone.utc)
        stmt = select(ExamLockPeriod).where(
            ExamLockPeriod.offering_id == offering_id,
            or_(ExamLockPeriod.component_type == component_type, ExamLockPeriod.component_type == "ALL")
        )
        locks = (await self.db.execute(stmt)).scalars().all()
        if not locks:
            lock = ExamLockPeriod(
                offering_id=offering_id,
                component_type=component_type,
                is_locked=True,
                locked_at=now_dt,
                locked_by_user_id=faculty_user.id,
            )
            self.db.add(lock)
        else:
            for l in locks:
                l.is_locked = True
                l.locked_at = now_dt
                l.locked_by_user_id = faculty_user.id

        await self.db.commit()
        return {"status": "LOCKED", "component": component_type, "locked_at": now_dt.isoformat()}

    async def request_unlock(
        self, offering_id: uuid.UUID, faculty_user: User, component_type: str, reason: str
    ) -> UnlockRequestOut:
        """Faculty requests unlock with justification for re-evaluations."""
        req = ExamUnlockRequest(
            offering_id=offering_id,
            component_type=component_type,
            requested_by_faculty_id=faculty_user.id,
            reason=reason,
            status="PENDING",
        )
        self.db.add(req)
        await self.db.commit()
        return UnlockRequestOut(
            id=str(req.id),
            offering_id=str(req.offering_id),
            component_type=req.component_type,
            requested_by_name=faculty_user.full_name,
            reason=req.reason,
            status=req.status,
            unlock_expires_at=req.unlock_expires_at,
            created_at=req.created_at,
        )

    # ------------------------------------------------------------------ OBE Attainment Engine
    async def compute_obe_attainment(self, offering_id: uuid.UUID) -> OBEAttainmentResponse:
        """Calculate class CO attainment and multiply with syllabus CO-PO articulation matrix."""
        offering = await self.db.get(CourseOffering, offering_id)
        if not offering:
            raise ExamServiceError("Course offering not found.", 404)
        course = await self.db.get(Course, offering.course_id)

        # Load Course Outcomes
        cos_stmt = select(CourseOutcome).where(CourseOutcome.course_id == course.id).order_by(CourseOutcome.co_code)
        cos = (await self.db.execute(cos_stmt)).scalars().all()

        # Load CO-PO Mappings from syllabus
        copo_stmt = select(CourseCOPOMapping).where(CourseCOPOMapping.course_id == course.id)
        copo_mappings = (await self.db.execute(copo_stmt)).scalars().all()
        weights_map: Dict[Tuple[str, str], int] = {(m.co_code, m.po_code): m.weight for m in copo_mappings}

        # Load template subcomponents
        tmpl_stmt = (
            select(ExamEvaluationTemplate)
            .where(ExamEvaluationTemplate.offering_id == offering_id)
            .options(selectinload(ExamEvaluationTemplate.components).selectinload(ExamComponent.sub_components))
        )
        tmpl = (await self.db.execute(tmpl_stmt)).scalars().first()
        if not tmpl:
            raise ExamServiceError("No assessment template found for this course.", 404)

        all_sub_comps: List[ExamSubComponent] = []
        for c in tmpl.components:
            all_sub_comps.extend(c.sub_components)

        # Load all marks
        marks_stmt = select(StudentMarksRecord).where(StudentMarksRecord.offering_id == offering_id)
        all_marks = (await self.db.execute(marks_stmt)).scalars().all()

        # Group marks by student and CO
        # { student_id: { "CO1": (marks_obtained, max_marks) } }
        student_co_scores: Dict[uuid.UUID, Dict[str, Tuple[float, float]]] = {}
        for m in all_marks:
            if m.is_absent:
                continue
            sub = next((s for s in all_sub_comps if s.id == m.sub_component_id), None)
            if not sub or not sub.mapped_cos:
                continue

            for co_code in sub.mapped_cos:
                st_map = student_co_scores.setdefault(m.student_id, {})
                cur_obt, cur_max = st_map.get(co_code, (0.0, 0.0))
                st_map[co_code] = (cur_obt + m.marks_obtained, cur_max + sub.max_marks)

        # Compute CO Attainment
        co_attainments: List[COAttainmentItem] = []
        co_levels: Dict[str, float] = {}

        for co in cos:
            total_students = 0
            meeting_target = 0
            for s_id, co_map in student_co_scores.items():
                if co.co_code in co_map:
                    obt, mx = co_map[co.co_code]
                    if mx > 0:
                        total_students += 1
                        pct = (obt / mx) * 100.0
                        if pct >= 60.0:  # Target threshold: 60%
                            meeting_target += 1

            attainment_pct = (meeting_target / total_students * 100.0) if total_students > 0 else 0.0

            # National Board of Accreditation (NBA) Levels:
            # Level 3: >= 70% of students scoring >= 60%
            # Level 2: 60% - 69%
            # Level 1: 50% - 59%
            # Level 0: < 50%
            if attainment_pct >= 70.0:
                lvl = 3
            elif attainment_pct >= 60.0:
                lvl = 2
            elif attainment_pct >= 50.0:
                lvl = 1
            else:
                lvl = 0

            co_levels[co.co_code] = lvl
            co_attainments.append(
                COAttainmentItem(
                    co_code=co.co_code,
                    description=co.description,
                    bloom_level=co.bloom_level,
                    total_evaluated_students=total_students,
                    target_marks_threshold_pct=60.0,
                    students_meeting_target=meeting_target,
                    percentage_attainment=round(attainment_pct, 1),
                    attainment_level=lvl,
                )
            )

        # Compute PO Attainments (Matrix Multiplication: Attainment Level * Weight / Total Weight)
        po_codes = [f"PO{i}" for i in range(1, 13)]
        pso_codes = ["PSO1", "PSO2"]

        po_attainments: List[POAttainmentItem] = []
        for po in po_codes:
            weighted_sum = 0.0
            total_weight = 0
            for co in cos:
                w = weights_map.get((co.co_code, po), 0)
                if w > 0:
                    weighted_sum += (co_levels.get(co.co_code, 0) / 3.0) * w
                    total_weight += w

            computed = (weighted_sum / total_weight * 3.0) if total_weight > 0 else 0.0
            po_attainments.append(
                POAttainmentItem(
                    po_code=po,
                    target_score=3.0,
                    computed_attainment=round(computed, 2),
                    attainment_level=round(computed, 1),
                )
            )

        pso_attainments: List[POAttainmentItem] = []
        for pso in pso_codes:
            weighted_sum = 0.0
            total_weight = 0
            for co in cos:
                w = weights_map.get((co.co_code, pso), 0)
                if w > 0:
                    weighted_sum += (co_levels.get(co.co_code, 0) / 3.0) * w
                    total_weight += w

            computed = (weighted_sum / total_weight * 3.0) if total_weight > 0 else 0.0
            pso_attainments.append(
                POAttainmentItem(
                    po_code=pso,
                    target_score=3.0,
                    computed_attainment=round(computed, 2),
                    attainment_level=round(computed, 1),
                )
            )

        summary = f"OBE analysis for {course.name}: Attainment calculated across {len(student_co_scores)} enrolled students against FRCRCE-3-26 syllabus matrix."

        return OBEAttainmentResponse(
            offering_id=str(offering_id),
            course_code=course.code,
            course_name=course.name,
            co_attainments=co_attainments,
            po_attainments=po_attainments,
            pso_attainments=pso_attainments,
            summary_text=summary,
        )

    # ------------------------------------------------------------------ Student View
    async def get_student_grades(self, student_user: User) -> List[StudentCourseGradeSummary]:
        """Fetch verified grades and component scores for enrolled student."""
        enroll_stmt = (
            select(StudentEnrollment)
            .where(StudentEnrollment.student_id == student_user.id)
            .options(
                selectinload(StudentEnrollment.offering).selectinload(CourseOffering.course),
            )
        )
        enrollments = (await self.db.execute(enroll_stmt)).scalars().all()

        summaries = []
        for enr in enrollments:
            off = enr.offering
            if not off or not off.course:
                continue

            tmpl_stmt = (
                select(ExamEvaluationTemplate)
                .where(ExamEvaluationTemplate.offering_id == off.id)
                .options(selectinload(ExamEvaluationTemplate.components).selectinload(ExamComponent.sub_components))
            )
            tmpl = (await self.db.execute(tmpl_stmt)).scalars().first()
            if not tmpl:
                continue

            # Load marks
            marks_stmt = select(StudentMarksRecord).where(
                StudentMarksRecord.offering_id == off.id,
                StudentMarksRecord.student_id == student_user.id,
            )
            marks_recs = (await self.db.execute(marks_stmt)).scalars().all()
            marks_dict = {m.sub_component_id: m for m in marks_recs}

            comp_list = []
            total_obt = 0.0
            total_max = 0.0

            for comp in tmpl.components:
                c_obt = 0.0
                has_marks = False
                for sub in comp.sub_components:
                    rec = marks_dict.get(sub.id)
                    if rec:
                        has_marks = True
                        if not rec.is_absent:
                            c_obt += rec.marks_obtained

                comp_list.append({
                    "component_type": comp.component_type,
                    "display_name": comp.display_name,
                    "max_marks": comp.max_marks,
                    "obtained_marks": round(c_obt, 2) if has_marks else 0.0,
                    "has_marks": has_marks,
                })
                if has_marks:
                    total_obt += c_obt
                    total_max += comp.max_marks

            pct = (total_obt / total_max * 100.0) if total_max > 0 else 0.0
            summaries.append(
                StudentCourseGradeSummary(
                    offering_id=str(off.id),
                    course_code=off.course.code,
                    course_name=off.course.name,
                    academic_term=off.academic_term,
                    components=comp_list,
                    total_marks_obtained=round(total_obt, 2),
                    total_max_marks=round(total_max, 2),
                    overall_percentage=round(pct, 1),
                )
            )

        return summaries
