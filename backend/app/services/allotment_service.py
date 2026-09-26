"""
Allotment Engine Service — Revision FRCRCE-3-26
================================================

Handles the complete allotment pipeline:
  1. Parse & validate Excel/CSV upload rows
  2. Resolve / create CourseOffering per (course_code, academic_term) pair
  3. Apply tier-based, balanced batch-splitting algorithm
  4. Persist everything inside a single database transaction
  5. Handle faculty cascade logic for INTEGRATED_TH_PR and THEORY_TUTORIAL modes

Balanced Chunking Algorithm:
  k = ceil(N / max_size)
  base_size = floor(N / k),  remainder = N % k
  First `remainder` chunks get base_size+1; rest get base_size.
"""
from __future__ import annotations

import io
import math
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    User, Course, CourseOffering, ClassSection, PracticalBatch, StudentEnrollment,
)
from app.schemas.allotment import AllotmentRowError


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Minimum students per batch / section constraint
MIN_STUDENTS_PER_BATCH = 12      # Minimum batch threshold
MIN_STUDENTS_PER_SECTION = 12    # Minimum section threshold

# Batch size targets per tier
CLASS_BATCH_MAX = 25        # Tier 1: class-level lab batches
DEPT_THEORY_MAX = 50        # Tier 2: PEC theory section threshold
DEPT_BATCH_MAX = 25         # Tier 2: PEC/PECL lab batch target
INST_THEORY_MAX = 60        # Tier 3: Institute-level theory section
INST_TUTORIAL_MAX = 30      # Tier 3: DM tutorial batch target

# Delivery modes that cascade theory faculty to all batches
CASCADE_MODES = {"INTEGRATED_TH_PR", "THEORY_TUTORIAL"}


# ---------------------------------------------------------------------------
# Balanced Chunking Helper
# ---------------------------------------------------------------------------

def balanced_chunks(items: list, max_size: int, min_size: int = MIN_STUDENTS_PER_BATCH) -> List[list]:
    """
    Deterministically split `items` (pre-sorted) into balanced sublists
    where each sublist has at most `max_size` elements and at least `min_size`
    elements (unless total items < min_size, in which case a single chunk is returned).

    Uses the formula:
        Initial k = ceil(N / max_size)
        If splitting into k chunks causes any chunk size to drop below min_size,
        reduce k = max(1, N // min_size).
        base_size = floor(N / k)
        remainder = N % k
    First `remainder` chunks have base_size+1 elements; the rest have base_size.
    """
    N = len(items)
    if N == 0:
        return []
    
    k = math.ceil(N / max_size)
    if k > 1 and (N // k) < min_size:
        k = max(1, N // min_size)

    base_size = N // k
    remainder = N % k

    chunks: List[list] = []
    idx = 0
    for i in range(k):
        chunk_size = base_size + (1 if i < remainder else 0)
        chunks.append(items[idx: idx + chunk_size])
        idx += chunk_size
    return chunks


# ---------------------------------------------------------------------------
# Row Validation Helpers
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS = {"student_id", "roll_no", "department", "class_div", "course_code", "academic_term"}


def validate_dataframe(df: pd.DataFrame) -> List[str]:
    """Return a list of missing column names."""
    missing = REQUIRED_COLUMNS - set(c.strip().lower() for c in df.columns)
    return list(missing)


# ---------------------------------------------------------------------------
# Main Allotment Engine
# ---------------------------------------------------------------------------

class AllotmentEngine:
    """
    Stateful engine that processes one Excel upload within a single async session.
    Designed to be used inside a single `async with session.begin()` block.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.errors: List[AllotmentRowError] = []
        self.sections_created = 0
        self.batches_created = 0
        self.faculty_slots_generated = 0

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def process_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Parse the Excel/CSV file, run the allotment pipeline, and commit.
        Returns a summary dict. Raises on unrecoverable errors.
        """
        df = self._parse_file(file_bytes, filename)
        df.columns = [c.strip().lower() for c in df.columns]

        missing = validate_dataframe(df)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Normalize and sort deterministically
        map_fn = getattr(df, "map", getattr(df, "applymap", None))
        df = map_fn(lambda x: x.strip() if isinstance(x, str) else x)
        df = df.sort_values(["course_code", "academic_term", "roll_no"]).reset_index(drop=True)

        total_rows = len(df)

        # ── Phase 1: Validate all student_ids against the DB
        student_map = await self._resolve_students(df)

        # ── Phase 2: Validate all course_codes against the DB
        course_map = await self._resolve_courses(df)

        # Stop here if validation errors found
        if self.errors:
            return self._summary(total_rows)

        # ── Phase 3: Group rows by (course_code, academic_term) → run allotment
        groups: Dict[Tuple[str, str], List[pd.Series]] = defaultdict(list)
        for _, row in df.iterrows():
            groups[(row["course_code"], row["academic_term"])].append(row)

        for (course_code, term), rows in groups.items():
            course = course_map[course_code]
            offering = await self._get_or_create_offering(course, term)
            # Clear previous allocations for this offering to allow clean recalculation
            await self._clear_offering_allocations(offering)
            await self._run_tier_allotment(course, offering, rows, student_map)

        return self._summary(total_rows)

    # ------------------------------------------------------------------
    # File Parsing
    # ------------------------------------------------------------------

    def _parse_file(self, file_bytes: bytes, filename: str) -> pd.DataFrame:
        buf = io.BytesIO(file_bytes)
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(buf, dtype=str)
        else:
            df = pd.read_excel(buf, dtype=str)

        # Auto-detect if comma or semicolon separated text was pasted into a single Excel column
        if len(df.columns) == 1 and ("," in str(df.columns[0]) or ";" in str(df.columns[0])):
            header_str = str(df.columns[0])
            delim = "," if "," in header_str else ";"
            raw_lines = [header_str] + [str(v) for v in df.iloc[:, 0].dropna()]
            df = pd.read_csv(io.StringIO("\n".join(raw_lines)), sep=delim, dtype=str)

        return df

    # ------------------------------------------------------------------
    # DB Resolution Helpers
    # ------------------------------------------------------------------

    async def _resolve_students(self, df: pd.DataFrame) -> Dict[str, User]:
        """Fetch all student User rows from DB, keyed by student_erp_id. Auto-creates any missing student accounts."""
        from app.core.security import hash_password
        erp_ids = [str(x).strip() for x in df["student_id"].unique().tolist() if pd.notna(x)]
        stmt = select(User).where(User.student_erp_id.in_(erp_ids))
        result = await self.db.execute(stmt)
        users = result.scalars().all()
        student_map = {u.student_erp_id: u for u in users}

        for _, row in df.iterrows():
            sid = str(row["student_id"]).strip()
            if sid and sid not in student_map:
                roll = str(row.get("roll_no", sid)).strip()
                student_user = User(
                    email=f"{sid.lower()}@student.academic.edu",
                    hashed_password=hash_password("student123"),
                    full_name=f"Student {sid}",
                    role="STUDENT",
                    student_erp_id=sid,
                    roll_no=roll,
                )
                self.db.add(student_user)
                await self.db.flush()
                student_map[sid] = student_user

        return student_map

    async def _resolve_courses(self, df: pd.DataFrame) -> Dict[str, Course]:
        """Fetch all Course rows from DB, keyed by code."""
        stmt = select(Course)
        result = await self.db.execute(stmt)
        all_courses = result.scalars().all()
        course_db_map = {c.code.strip().upper(): c for c in all_courses}

        course_map = {}
        for i, row in df.iterrows():
            code = str(row["course_code"]).strip()
            code_upper = code.upper()
            if code_upper in course_db_map:
                course_map[code] = course_db_map[code_upper]
            else:
                self.errors.append(AllotmentRowError(
                    row=i + 2,
                    student_id=str(row.get("student_id", "")).strip(),
                    course_code=code,
                    error=f"course_code '{code}' not found in the courses table (available: {', '.join(sorted(course_db_map.keys()))})"
                ))
        return course_map

    async def _get_or_create_offering(self, course: Course, term: str) -> CourseOffering:
        """Fetch or create a CourseOffering for this (course, term) pair."""
        stmt = select(CourseOffering).where(
            CourseOffering.course_id == course.id,
            CourseOffering.academic_term == term,
        )
        result = await self.db.execute(stmt)
        offering = result.scalar_one_or_none()
        if offering is None:
            offering = CourseOffering(course_id=course.id, academic_term=term)
            self.db.add(offering)
            await self.db.flush()  # get offering.id
        return offering

    async def _clear_offering_allocations(self, offering: CourseOffering) -> None:
        """Clear existing enrollments, batches, and sections for this offering before fresh re-allotment."""
        await self.db.execute(
            delete(StudentEnrollment).where(StudentEnrollment.offering_id == offering.id)
        )
        await self.db.execute(
            delete(PracticalBatch).where(PracticalBatch.offering_id == offering.id)
        )
        await self.db.execute(
            delete(ClassSection).where(ClassSection.offering_id == offering.id)
        )
        await self.db.flush()

    # ------------------------------------------------------------------
    # Tier-Based Allotment Dispatcher
    # ------------------------------------------------------------------

    async def _run_tier_allotment(
        self,
        course: Course,
        offering: CourseOffering,
        rows: List[pd.Series],
        student_map: Dict[str, User],
    ) -> None:
        """Dispatch allotment logic based on course_tier."""
        tier = course.course_tier
        if tier == "CLASS":
            await self._allot_class_tier(course, offering, rows, student_map)
        elif tier == "DEPARTMENT":
            await self._allot_department_tier(course, offering, rows, student_map)
        elif tier == "INSTITUTE":
            await self._allot_institute_tier(course, offering, rows, student_map)

    # ------------------------------------------------------------------
    # Tier 1: CLASS-Level Allotment
    # ------------------------------------------------------------------

    async def _allot_class_tier(
        self,
        course: Course,
        offering: CourseOffering,
        rows: List[pd.Series],
        student_map: Dict[str, User],
    ) -> None:
        """
        Tier 1 — CLASS (PCC / VSEC):
        Group by class_div. Per division:
          - INTEGRATED_TH_PR / THEORY_TUTORIAL → 1 theory section + balanced batches (≤25)
          - PRACTICAL_ONLY → no theory section, balanced batches (≤25)
          - THEORY_ONLY → 1 theory section, no batches
        """
        mode = course.delivery_mode

        # Group rows by class_div
        div_groups: Dict[str, List[pd.Series]] = defaultdict(list)
        for row in rows:
            div_groups[row["class_div"]].append(row)

        for div_name, div_rows in div_groups.items():
            # Sort students by roll_no for determinism
            div_rows.sort(key=lambda r: r["roll_no"])
            students = [student_map[r["student_id"]] for r in div_rows if r["student_id"] in student_map]

            section: Optional[ClassSection] = None

            # Create theory section for modes that have theory
            if mode in ("INTEGRATED_TH_PR", "THEORY_TUTORIAL", "THEORY_ONLY"):
                section_name = f"{div_name}-Theory"
                section = await self._get_or_create_section(offering, section_name)
                self.faculty_slots_generated += 1  # slot for theory faculty

            if mode == "THEORY_ONLY":
                # Enroll all students in the section, no batches
                for student in students:
                    await self._upsert_enrollment(student, offering, section=section, batch=None)
                continue

            # Create balanced lab/tutorial batches
            batch_chunks = balanced_chunks(students, CLASS_BATCH_MAX)
            for i, chunk in enumerate(batch_chunks, start=1):
                batch_name = f"{div_name}-B{i}"
                batch = await self._get_or_create_batch(offering, batch_name, parent_section=section)
                if mode == "PRACTICAL_ONLY":
                    self.faculty_slots_generated += 1  # independent slot per batch
                for student in chunk:
                    await self._upsert_enrollment(student, offering, section=section, batch=batch)

    # ------------------------------------------------------------------
    # Tier 2: DEPARTMENT-Level Allotment
    # ------------------------------------------------------------------

    async def _allot_department_tier(
        self,
        course: Course,
        offering: CourseOffering,
        rows: List[pd.Series],
        student_map: Dict[str, User],
    ) -> None:
        """
        Tier 2 — DEPARTMENT (PEC / PECL):
        Pool all students (across divisions) who chose this elective.
        - If total ≤ DEPT_THEORY_MAX (50): 1 combined theory section.
        - If total > 50: balanced split into ≤50 sections.
        Each theory section is further split into lab batches (≤25).
        """
        mode = course.delivery_mode

        # Sort students deterministically by roll_no
        rows.sort(key=lambda r: r["roll_no"])
        students = [student_map[r["student_id"]] for r in rows if r["student_id"] in student_map]

        # Split into theory sections
        theory_chunks = balanced_chunks(students, DEPT_THEORY_MAX)

        base_name = course.code.replace("25PEC", "PEC").replace("25PECL", "PECL")

        for sec_idx, sec_students in enumerate(theory_chunks, start=1):
            section_name = f"{base_name}-Sec{sec_idx}" if len(theory_chunks) > 1 else f"{base_name}-Sec1"
            section: Optional[ClassSection] = None

            if mode != "PRACTICAL_ONLY":
                section = await self._get_or_create_section(offering, section_name)
                self.faculty_slots_generated += 1

            # Lab batches per section (PECL or INTEGRATED_TH_PR)
            if mode in ("INTEGRATED_TH_PR", "PRACTICAL_ONLY"):
                batch_chunks = balanced_chunks(sec_students, DEPT_BATCH_MAX)
                for b_idx, chunk in enumerate(batch_chunks, start=1):
                    batch_name = f"{section_name}-Lab{b_idx}"
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section)
                    if mode == "PRACTICAL_ONLY":
                        self.faculty_slots_generated += 1
                    for student in chunk:
                        await self._upsert_enrollment(student, offering, section=section, batch=batch)
            else:
                # THEORY_TUTORIAL or THEORY_ONLY: tutorial batches or none
                if mode == "THEORY_TUTORIAL":
                    batch_chunks = balanced_chunks(sec_students, DEPT_BATCH_MAX)
                    for b_idx, chunk in enumerate(batch_chunks, start=1):
                        batch_name = f"{section_name}-Tut{b_idx}"
                        batch = await self._get_or_create_batch(offering, batch_name, parent_section=section)
                        for student in chunk:
                            await self._upsert_enrollment(student, offering, section=section, batch=batch)
                else:
                    for student in sec_students:
                        await self._upsert_enrollment(student, offering, section=section, batch=None)

    # ------------------------------------------------------------------
    # Tier 3: INSTITUTE-Level Allotment
    # ------------------------------------------------------------------

    async def _allot_institute_tier(
        self,
        course: Course,
        offering: CourseOffering,
        rows: List[pd.Series],
        student_map: Dict[str, User],
    ) -> None:
        """
        Tier 3 — INSTITUTE (OE / DM / MDM / Honors):
        Pool all students college-wide.
        - Theory sections: ≤60 students each.
        - If tu_hours > 0: tutorial batches ≤30 within each theory section.
        - If THEORY_ONLY (lecture-only): no batches.
        """
        mode = course.delivery_mode

        rows.sort(key=lambda r: r["roll_no"])
        students = [student_map[r["student_id"]] for r in rows if r["student_id"] in student_map]

        theory_chunks = balanced_chunks(students, INST_THEORY_MAX)
        base_name = course.code

        for sec_idx, sec_students in enumerate(theory_chunks, start=1):
            section_name = f"{base_name}-Sec{sec_idx}"
            section: Optional[ClassSection] = None

            if mode != "PRACTICAL_ONLY":
                section = await self._get_or_create_section(offering, section_name)
                self.faculty_slots_generated += 1

            if mode == "THEORY_ONLY":
                for student in sec_students:
                    await self._upsert_enrollment(student, offering, section=section, batch=None)
                continue

            # Tutorial batches (DM courses with tu_hours > 0)
            if course.tu_hours > 0 or mode == "THEORY_TUTORIAL":
                tut_chunks = balanced_chunks(sec_students, INST_TUTORIAL_MAX)
                for t_idx, chunk in enumerate(tut_chunks, start=1):
                    batch_name = f"{section_name}-Tut{t_idx}"
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section)
                    for student in chunk:
                        await self._upsert_enrollment(student, offering, section=section, batch=batch)
            elif mode in ("INTEGRATED_TH_PR", "PRACTICAL_ONLY"):
                batch_chunks = balanced_chunks(sec_students, DEPT_BATCH_MAX)
                for b_idx, chunk in enumerate(batch_chunks, start=1):
                    batch_name = f"{section_name}-Lab{b_idx}"
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section)
                    if mode == "PRACTICAL_ONLY":
                        self.faculty_slots_generated += 1
                    for student in chunk:
                        await self._upsert_enrollment(student, offering, section=section, batch=batch)
            else:
                for student in sec_students:
                    await self._upsert_enrollment(student, offering, section=section, batch=None)

    # ------------------------------------------------------------------
    # DB Write Helpers
    # ------------------------------------------------------------------

    async def _get_or_create_section(
        self, offering: CourseOffering, section_name: str
    ) -> ClassSection:
        stmt = select(ClassSection).where(
            ClassSection.offering_id == offering.id,
            ClassSection.section_name == section_name,
        )
        result = await self.db.execute(stmt)
        section = result.scalar_one_or_none()
        if section is None:
            section = ClassSection(offering_id=offering.id, section_name=section_name)
            self.db.add(section)
            await self.db.flush()
            self.sections_created += 1
        return section

    async def _get_or_create_batch(
        self,
        offering: CourseOffering,
        batch_name: str,
        parent_section: Optional[ClassSection] = None,
    ) -> PracticalBatch:
        stmt = select(PracticalBatch).where(
            PracticalBatch.offering_id == offering.id,
            PracticalBatch.batch_name == batch_name,
        )
        result = await self.db.execute(stmt)
        batch = result.scalar_one_or_none()
        if batch is None:
            batch = PracticalBatch(
                offering_id=offering.id,
                section_id=parent_section.id if parent_section else None,
                batch_name=batch_name,
            )
            self.db.add(batch)
            await self.db.flush()
            self.batches_created += 1
        return batch

    async def _upsert_enrollment(
        self,
        student: User,
        offering: CourseOffering,
        section: Optional[ClassSection],
        batch: Optional[PracticalBatch],
    ) -> None:
        """Create or update a StudentEnrollment record (idempotent on re-upload)."""
        stmt = select(StudentEnrollment).where(
            StudentEnrollment.student_id == student.id,
            StudentEnrollment.offering_id == offering.id,
        )
        result = await self.db.execute(stmt)
        enrollment = result.scalar_one_or_none()
        if enrollment is None:
            enrollment = StudentEnrollment(
                student_id=student.id,
                offering_id=offering.id,
                section_id=section.id if section else None,
                batch_id=batch.id if batch else None,
            )
            self.db.add(enrollment)
        else:
            # Update if re-running allotment
            if section:
                enrollment.section_id = section.id
            if batch:
                enrollment.batch_id = batch.id
        await self.db.flush()

    # ------------------------------------------------------------------
    # Summary Helper
    # ------------------------------------------------------------------

    def _summary(self, total_rows: int) -> Dict[str, Any]:
        return {
            "status": "success" if not self.errors else "partial",
            "total_rows_processed": total_rows,
            "sections_created": self.sections_created,
            "batches_created": self.batches_created,
            "faculty_slots_generated": self.faculty_slots_generated,
            "errors": [e.model_dump() for e in self.errors],
        }


# ---------------------------------------------------------------------------
# Faculty Cascade Service
# ---------------------------------------------------------------------------

async def cascade_faculty_to_batches(
    db: AsyncSession, section_id: uuid.UUID, faculty_id: uuid.UUID
) -> int:
    """
    For INTEGRATED_TH_PR and THEORY_TUTORIAL sections:
    propagate the faculty assignment to all child PracticalBatches.
    Returns the number of batches updated.
    """
    stmt = select(PracticalBatch).where(PracticalBatch.section_id == section_id)
    result = await db.execute(stmt)
    batches = result.scalars().all()
    for batch in batches:
        batch.faculty_id = faculty_id
    await db.flush()
    return len(batches)
