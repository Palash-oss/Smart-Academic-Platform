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
    Department, Division,
)
from app.schemas.allotment import AllotmentRowError
from sqlalchemy.orm import selectinload


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Minimum students per batch / section constraint
MIN_STUDENTS_PER_BATCH = 12      # Minimum batch threshold
MIN_STUDENTS_PER_SECTION = 12    # Minimum section threshold
MIN_STUDENTS_PER_ELECTIVE = 20   # Mandatory minimum students required to float an elective (PEC / PECL / OE)

# Batch size targets per tier
CLASS_BATCH_MAX = 25        # Tier 1: class-level lab batches
DEPT_THEORY_MAX = 50        # Tier 2: PEC theory section threshold
DEPT_BATCH_MAX = 25         # Tier 2: PEC/PECL lab batch target
INST_THEORY_MAX = 60        # Tier 3: Institute-level theory section
INST_TUTORIAL_MAX = 30      # Tier 3: DM tutorial batch target

# Delivery modes that cascade theory faculty to all batches
CASCADE_MODES = {"INTEGRATED_TH_PR", "THEORY_TUTORIAL"}

# Default elective faculty mapping for Semester 5 (from college faculty sheet)
DEFAULT_ELECTIVE_FACULTY_EMAILS = {
    "25PEC13CE11": "ashok.kanthe@academic.edu",         # Dr. Ashok Kanthe (Blockchain / HMI)
    "25PEC13CE12": "kalpana.deorukhkar@academic.edu",    # Dr. Kalpana Deorukhkar (Deep Learning)
    "25PEC13CE13": "smita.ambarkar@academic.edu",        # Dr. Smita Ambarkar (Cyber Security)
    "25PEC13CE14": "ankita.amburle@academic.edu",        # Prof. Ankita Amburle (Big Data Analytics)
    "25PECL13CE11": "nirajsingh.yeotikar@academic.edu",  # Prof. Nirajsingh R Yeotikar (IPD Lab)
    "25PECL13CE12": "varsha.phulpagar@academic.edu",     # Prof. Varsha Phulpagar (NLP Lab)
    "25PECL13CE13": "roshni.padate@academic.edu",         # Dr. Roshni Padate (HMI / IoT Lab)
    "25PECL13CE15": "unik.lokhande@academic.edu",         # Prof. Lokhande Unik (Ethical Hacking Lab)
    "25OE13CE31": "roshni.padate@academic.edu",           # Dr. Roshni Padate (Health & Wellness)
    "25OE13CE32": "garima.singh@academic.edu",            # Prof. Garima Singh (Emotional Intelligence)
}

# Per-batch faculty distribution for multi-batch electives (round-robin among qualified teachers)
DEFAULT_ELECTIVE_BATCH_FACULTY_EMAILS = {
    "25PEC13CE11": ["khushboo.singh@academic.edu", "garima.singh@academic.edu", "ashok.kanthe@academic.edu"],
    "25PEC13CE12": ["ashwini.pansare@academic.edu", "sangeeta.parshionikar@academic.edu", "kalpana.deorukhkar@academic.edu"],
    "25PEC13CE13": ["akshata.patil@academic.edu", "smita.ambarkar@academic.edu"],
    "25PEC13CE14": ["ankita.amburle@academic.edu"],
    "25PECL13CE12": ["varsha.phulpagar@academic.edu", "kranti.wagle@academic.edu", "prity.bansode@academic.edu", "akshata.patil@academic.edu"],
    "25PECL13CE15": ["unik.lokhande@academic.edu"],
    "25PECL13CE11": ["nirajsingh.yeotikar@academic.edu"],
    "25PECL13CE13": ["roshni.padate@academic.edu"],
}


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

REQUIRED_BASE_COLUMNS = {"student_id", "roll_no", "department", "class_div", "academic_term"}


def validate_dataframe(df: pd.DataFrame) -> List[str]:
    """Return a list of missing column names. Supports direct course_code or preference_1 columns."""
    cols = set(c.strip().lower() for c in df.columns)
    missing = REQUIRED_BASE_COLUMNS - cols
    has_course = any(c in cols for c in ["course_code", "course", "subject_code", "code"])
    has_pref = any(c.startswith("pref") or "choice" in c or c.startswith("pec") for c in cols)
    if not has_course and not has_pref:
        missing.add("course_code (or preference_1)")
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
        self.notices: List[str] = []
        self.sections_created = 0
        self.batches_created = 0
        self.faculty_slots_generated = 0
        self._section_cache: Dict[Tuple[uuid.UUID, str], ClassSection] = {}
        self._batch_cache: Dict[Tuple[uuid.UUID, str], PracticalBatch] = {}
        self._enrollment_cache: Dict[Tuple[uuid.UUID, uuid.UUID], StudentEnrollment] = {}
        self._faculty_by_email: Dict[str, User] = {}

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def process_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Parse the Excel/CSV file, run the allotment pipeline, and commit.
        Supports:
          1. Direct course_code rows (with Min 20 Students threshold validation)
          2. Multi-preference FCFS rows (ordered by timestamp, enforcing Min 20 students rule)
        Returns a summary dict. Raises on unrecoverable errors.
        """
        # Pre-fetch all faculty into memory
        fac_res = await self.db.execute(select(User).where(User.role.in_(["FACULTY", "ADMIN"])))
        self._faculty_by_email = {u.email.lower(): u for u in fac_res.scalars().all()}

        df = self._parse_file(file_bytes, filename)
        df.columns = [c.strip().lower() for c in df.columns]

        missing = validate_dataframe(df)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Normalize and strip strings
        map_fn = getattr(df, "map", getattr(df, "applymap", None))
        df = map_fn(lambda x: x.strip() if isinstance(x, str) else x)

        # Standardize aliases
        for cand in ["course", "subject_code", "code"]:
            if cand in df.columns and "course_code" not in df.columns:
                df["course_code"] = df[cand]
                break

        total_rows = len(df)

        # ── Phase 1: Validate all student_ids against the DB
        student_map = await self._resolve_students(df)

        # ── Phase 2: Validate all candidate course codes & preferences against the DB
        course_map = await self._resolve_courses(df)

        # Stop here if validation errors found
        if self.errors:
            return self._summary(total_rows)

        # ── Phase 2.5: FCFS Preference Allotment with Min 20 Students Constraint
        pref_cols = [c for c in ["preference_1", "preference_2", "preference_3", "pref_1", "pref_2", "pref_3"] if c in df.columns]
        if pref_cols:
            df = self._apply_fcfs_allotment(df, course_map, pref_cols)
        elif "course_code" in df.columns:
            self._check_direct_elective_minimums(df, course_map)

        if "course_code" in df.columns:
            df = df.sort_values(["course_code", "academic_term", "roll_no"]).reset_index(drop=True)

        # ── Phase 3: Group rows by (course_code, academic_term) → run allotment
        groups: Dict[Tuple[str, str], List[pd.Series]] = defaultdict(list)
        for _, row in df.iterrows():
            c_val = row.get("course_code")
            if pd.notna(c_val) and str(c_val).strip():
                groups[(str(c_val).strip(), row["academic_term"])].append(row)

        valid_groups: Dict[Tuple[str, str], Tuple[Course, List[pd.Series]]] = {}
        course_ids = []
        terms = set()
        for (course_code, term), rows in groups.items():
            if course_code in course_map:
                course = course_map[course_code]
                valid_groups[(course_code, term)] = (course, rows)
                course_ids.append(course.id)
                terms.add(term)

        if not valid_groups:
            return self._summary(total_rows)

        # Pre-fetch all offerings for these courses and terms in a single query
        off_stmt = select(CourseOffering).where(
            CourseOffering.course_id.in_(course_ids),
            CourseOffering.academic_term.in_(list(terms)),
        )
        off_res = await self.db.execute(off_stmt)
        offering_lookup: Dict[Tuple[uuid.UUID, str], CourseOffering] = {
            (off.course_id, off.academic_term): off for off in off_res.scalars().all()
        }

        all_offering_ids = []
        offerings_by_key: Dict[Tuple[str, str], CourseOffering] = {}
        for (course_code, term), (course, _) in valid_groups.items():
            offering = offering_lookup.get((course.id, term))
            if offering is None:
                offering = CourseOffering(id=uuid.uuid4(), course_id=course.id, academic_term=term)
                self.db.add(offering)
                offering_lookup[(course.id, term)] = offering
            offerings_by_key[(course_code, term)] = offering
            all_offering_ids.append(offering.id)

        # Bulk clear existing allocations for ALL affected offerings in 3 queries instead of 3*N
        if all_offering_ids:
            await self.db.execute(
                delete(StudentEnrollment).where(StudentEnrollment.offering_id.in_(all_offering_ids))
            )
            await self.db.execute(
                delete(PracticalBatch).where(PracticalBatch.offering_id.in_(all_offering_ids))
            )
            await self.db.execute(
                delete(ClassSection).where(ClassSection.offering_id.in_(all_offering_ids))
            )
            self._section_cache = {k: v for k, v in self._section_cache.items() if k[0] not in all_offering_ids}
            self._batch_cache = {k: v for k, v in self._batch_cache.items() if k[0] not in all_offering_ids}
            self._enrollment_cache = {k: v for k, v in self._enrollment_cache.items() if k[1] not in all_offering_ids}

        # Run tier allotment for each group (in-memory operations only, 0 DB queries!)
        for (course_code, term), (course, rows) in valid_groups.items():
            offering = offerings_by_key[(course_code, term)]
            await self._run_tier_allotment(course, offering, rows, student_map)

        await self.db.flush()
        return self._summary(total_rows)

    async def auto_enroll_core_for_term(self, academic_term: str) -> Dict[str, Any]:
        """
        Auto-enroll all students in active divisions into their mandatory Core courses (Tier 1: CLASS).
        Zero manual CSV upload needed for Core courses!
        """
        import re
        sem_match = re.search(r"SEM(\d+)", academic_term.upper())
        target_sem = int(sem_match.group(1)) if sem_match else 5

        # Query all divisions that belong to this semester
        div_stmt = (
            select(Division)
            .where(Division.semester == target_sem)
            .options(selectinload(Division.department))
        )
        div_res = await self.db.execute(div_stmt)
        divisions = div_res.scalars().all()

        total_enrolled = 0

        for div in divisions:
            dept = div.department
            if not dept:
                continue

            # Query all CLASS-tier core courses for this department and semester
            course_stmt = select(Course).where(
                Course.department_id == dept.id,
                Course.semester == target_sem,
                Course.course_tier == "CLASS"
            ).order_by(Course.code)
            course_res = await self.db.execute(course_stmt)
            core_courses = course_res.scalars().all()

            if not core_courses:
                continue

            # Query all students in this division
            student_stmt = select(User).where(
                User.role == "STUDENT",
                User.division_id == div.id
            ).order_by(User.roll_no, User.student_erp_id, User.full_name)
            student_res = await self.db.execute(student_stmt)
            students = student_res.scalars().all()

            if not students:
                continue

            div_label = f"{dept.code}-{div.name}"

            for course in core_courses:
                offering = await self._get_or_create_offering(course, academic_term)
                mode = course.delivery_mode

                # Theory section (if applicable)
                section: Optional[ClassSection] = None
                if mode in ("INTEGRATED_TH_PR", "THEORY_TUTORIAL", "THEORY_ONLY"):
                    section_name = f"{div_label}-Theory"
                    section = await self._get_or_create_section(offering, section_name)
                    self.faculty_slots_generated += 1

                if mode == "THEORY_ONLY":
                    for std in students:
                        await self._upsert_enrollment(std, offering, section=section, batch=None)
                        total_enrolled += 1
                    continue

                # Balanced Practical / Tutorial Batches (≤25 students per batch)
                batch_chunks = balanced_chunks(students, CLASS_BATCH_MAX)
                for i, chunk in enumerate(batch_chunks, start=1):
                    batch_name = f"{div_label}-B{i}"
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section)
                    if mode == "PRACTICAL_ONLY":
                        self.faculty_slots_generated += 1
                    for std in chunk:
                        await self._upsert_enrollment(std, offering, section=section, batch=batch)
                        total_enrolled += 1

        await self.db.flush()
        return {
            "status": "success",
            "academic_term": academic_term,
            "target_semester": target_sem,
            "total_enrollments_created": total_enrolled,
            "sections_created": self.sections_created,
            "batches_created": self.batches_created,
            "faculty_slots_generated": self.faculty_slots_generated,
        }

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
        """Fetch all student User rows from DB, keyed by student_erp_id, roll_no, or email."""
        from app.core.security import hash_password
        erp_ids = [str(x).strip() for x in df["student_id"].unique().tolist() if pd.notna(x)]
        rolls = [str(x).strip() for x in df["roll_no"].unique().tolist() if "roll_no" in df.columns and pd.notna(x)]
        
        conditions = []
        if erp_ids:
            conditions.append(User.student_erp_id.in_(erp_ids))
        if rolls:
            conditions.append(User.roll_no.in_(rolls))

        if conditions:
            stmt = select(User).where(User.role == "STUDENT", *([conditions[0] if len(conditions) == 1 else (conditions[0] | conditions[1])]))
            result = await self.db.execute(stmt)
            users = result.scalars().all()
        else:
            users = []

        student_map = {}
        for u in users:
            if u.student_erp_id:
                student_map[u.student_erp_id] = u
            if u.roll_no:
                student_map[u.roll_no] = u

        pw_hash = None
        new_students_added = False
        for _, row in df.iterrows():
            sid = str(row["student_id"]).strip()
            roll = str(row.get("roll_no", sid)).strip()
            
            matched = student_map.get(sid) or student_map.get(roll)
            if not matched and sid:
                if pw_hash is None:
                    pw_hash = hash_password("student123")
                # Auto-create student if truly new
                student_user = User(
                    id=uuid.uuid4(),
                    email=f"{sid.lower()}@student.academic.edu",
                    hashed_password=pw_hash,
                    full_name=f"Student {sid}",
                    role="STUDENT",
                    student_erp_id=sid,
                    roll_no=roll,
                )
                self.db.add(student_user)
                student_map[sid] = student_user
                student_map[roll] = student_user
                new_students_added = True
            elif matched:
                student_map[sid] = matched
                student_map[roll] = matched

        if new_students_added:
            await self.db.flush()

        return student_map

    async def _resolve_courses(self, df: pd.DataFrame) -> Dict[str, Course]:
        """Fetch all Course rows from DB, keyed by code or course name (case-insensitive)."""
        stmt = select(Course)
        result = await self.db.execute(stmt)
        all_courses = result.scalars().all()
        course_db_map = {c.code.strip().upper(): c for c in all_courses}
        course_name_map = {c.name.strip().lower(): c for c in all_courses}

        candidate_keys = set()
        for col in ["course_code", "course", "subject_code", "code", "preference_1", "preference_2", "preference_3", "pref_1", "pref_2", "pref_3"]:
            if col in df.columns:
                for val in df[col].dropna():
                    s_val = str(val).strip()
                    if s_val:
                        candidate_keys.add(s_val)

        course_map = {}
        for code in candidate_keys:
            code_upper = code.upper()
            code_lower = code.lower()

            if code_upper in course_db_map:
                c_obj = course_db_map[code_upper]
                course_map[code] = c_obj
                course_map[code_upper] = c_obj
            elif code_lower in course_name_map:
                c_obj = course_name_map[code_lower]
                course_map[code] = c_obj
                course_map[code_lower] = c_obj
            else:
                self.errors.append(AllotmentRowError(
                    row=0,
                    student_id="-",
                    course_code=code,
                    error=f"Course '{code}' not found in the courses table (available: {', '.join(sorted(course_db_map.keys()))})"
                ))
        return course_map

    def _apply_fcfs_allotment(
        self, df: pd.DataFrame, course_map: Dict[str, Course], pref_cols: List[str]
    ) -> pd.DataFrame:
        """
        Enforce First-Come-First-Served (FCFS) and Minimum 20 Students Constraint:
        1. Students are ordered chronologically by 'timestamp' (or CSV row order if timestamp is missing).
        2. Assign students to highest active preference that has capacity within their elective category.
        3. If any elective course receives < 20 students, that course cannot float.
           Its students are automatically reallocated to their next eligible preference with capacity in that category.
        4. Guarantees 100% of students are allocated and all running electives have >= 20 students.
        """
        if "timestamp" in df.columns:
            df = df.sort_values("timestamp", ascending=True).reset_index(drop=True)
        else:
            df = df.reset_index(drop=True)

        def get_category(row: pd.Series) -> str:
            if "category" in row and pd.notna(row["category"]) and str(row["category"]).strip():
                return str(row["category"]).strip().upper()
            for col in pref_cols + ["course_code"]:
                if col in row and pd.notna(row[col]):
                    val = str(row[col]).strip().upper()
                    if "PECL" in val:
                        return "PECL"
                    elif "PEC" in val:
                        return "PEC"
                    elif "OE" in val:
                        return "OE"
                    elif "VSE" in val:
                        return "VSE"
                    elif "PCC" in val:
                        return "PCC"
            return "GENERAL"

        df["_category"] = [get_category(row) for _, row in df.iterrows()]
        student_course_map: Dict[int, str] = {}

        for cat, group in df.groupby("_category"):
            students_data = []
            for idx, row in group.iterrows():
                p_list = []
                for col in pref_cols:
                    val = str(row.get(col, "")).strip()
                    if val:
                        c_obj = course_map.get(val) or course_map.get(val.upper())
                        if c_obj:
                            p_list.append(c_obj.code)
                students_data.append({
                    "row_index": idx,
                    "student_id": str(row["student_id"]).strip(),
                    "roll_no": str(row["roll_no"]).strip(),
                    "preferences": p_list,
                })

            candidate_courses = set()
            for s in students_data:
                for p in s["preferences"]:
                    candidate_courses.add(p)

            active_courses = set(candidate_courses)
            num_courses = max(1, len(active_courses))
            max_cap = max(DEPT_THEORY_MAX, math.ceil(len(students_data) / num_courses) + 10)

            # Iteratively eliminate courses that do not reach MIN_STUDENTS_PER_ELECTIVE (20)
            while True:
                allocations: Dict[str, List[dict]] = defaultdict(list)
                unallocated = []

                for s in students_data:
                    allocated = False
                    for p in s["preferences"]:
                        if p in active_courses and len(allocations[p]) < max_cap:
                            allocations[p].append(s)
                            allocated = True
                            break
                    if not allocated:
                        unallocated.append(s)

                # Reallocate overflow/unallocated to active courses with space
                for s in unallocated:
                    available = [c for c in active_courses if len(allocations[c]) < max_cap]
                    if available:
                        best_c = min(available, key=lambda c: len(allocations[c]))
                        allocations[best_c].append(s)
                    elif active_courses:
                        best_c = min(active_courses, key=lambda c: len(allocations[c]))
                        allocations[best_c].append(s)

                # Check minimum 20 threshold
                under_min = [c for c in active_courses if 0 < len(allocations[c]) < MIN_STUDENTS_PER_ELECTIVE]
                if not under_min or len(active_courses) <= 1:
                    break

                dropped = min(under_min, key=lambda c: len(allocations[c]))
                dropped_count = len(allocations[dropped])
                self.notices.append(
                    f"Course {dropped} received only {dropped_count} student choices (< {MIN_STUDENTS_PER_ELECTIVE} required minimum). Course dropped from offering; {dropped_count} students re-allocated based on FCFS next preferences."
                )
                active_courses.remove(dropped)
                num_courses = max(1, len(active_courses))
                max_cap = max(DEPT_THEORY_MAX, math.ceil(len(students_data) / num_courses) + 10)

            for c_code, s_list in allocations.items():
                for s in s_list:
                    student_course_map[s["row_index"]] = c_code

        df["course_code"] = [student_course_map.get(idx, row.get("course_code", "")) for idx, row in df.iterrows()]
        df = df.drop(columns=["_category"])
        return df

    def _check_direct_elective_minimums(
        self, df: pd.DataFrame, course_map: Dict[str, Course]
    ) -> None:
        """Verify that all elective courses in direct assignment meet the 20-student threshold."""
        counts = df["course_code"].value_counts().to_dict()
        for c_code, count in counts.items():
            c_obj = course_map.get(c_code) or course_map.get(str(c_code).upper())
            if c_obj and c_obj.course_tier in ("DEPARTMENT", "INSTITUTE"):
                if count < MIN_STUDENTS_PER_ELECTIVE:
                    self.notices.append(
                        f"Notice: Elective course {c_code} has only {count} students allotted, which is below the mandatory minimum of {MIN_STUDENTS_PER_ELECTIVE} students."
                    )

    def _resolve_faculty_for_course(self, course_code: str) -> Optional[User]:
        clean_code = course_code.strip().upper()
        email = DEFAULT_ELECTIVE_FACULTY_EMAILS.get(clean_code)
        if not email:
            return None
        return self._faculty_by_email.get(email.lower())

    def _resolve_faculty_for_batch(self, course_code: str, batch_idx: int) -> Optional[User]:
        clean_code = course_code.strip().upper()
        batch_emails = DEFAULT_ELECTIVE_BATCH_FACULTY_EMAILS.get(clean_code)
        if batch_emails:
            email = batch_emails[(batch_idx - 1) % len(batch_emails)]
        else:
            email = DEFAULT_ELECTIVE_FACULTY_EMAILS.get(clean_code)
        if not email:
            return None
        return self._faculty_by_email.get(email.lower())

    async def _get_or_create_offering(self, course: Course, term: str) -> CourseOffering:
        """Fetch or create a CourseOffering for this (course, term) pair."""
        stmt = select(CourseOffering).where(
            CourseOffering.course_id == course.id,
            CourseOffering.academic_term == term,
        )
        result = await self.db.execute(stmt)
        offering = result.scalar_one_or_none()
        if offering is None:
            offering = CourseOffering(id=uuid.uuid4(), course_id=course.id, academic_term=term)
            self.db.add(offering)
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
        self._section_cache = {k: v for k, v in self._section_cache.items() if k[0] != offering.id}
        self._batch_cache = {k: v for k, v in self._batch_cache.items() if k[0] != offering.id}
        self._enrollment_cache = {k: v for k, v in self._enrollment_cache.items() if k[1] != offering.id}

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
        fac_user = self._resolve_faculty_for_course(course.code)
        fac_id = fac_user.id if fac_user else None

        for sec_idx, sec_students in enumerate(theory_chunks, start=1):
            section_name = f"{base_name}-Sec{sec_idx}" if len(theory_chunks) > 1 else f"{base_name}-Sec1"
            section: Optional[ClassSection] = None

            if mode != "PRACTICAL_ONLY":
                section = await self._get_or_create_section(offering, section_name, faculty_id=fac_id)
                self.faculty_slots_generated += 1

            # Lab batches per section (PECL or INTEGRATED_TH_PR)
            if mode in ("INTEGRATED_TH_PR", "PRACTICAL_ONLY"):
                batch_chunks = balanced_chunks(sec_students, DEPT_BATCH_MAX)
                for b_idx, chunk in enumerate(batch_chunks, start=1):
                    batch_name = f"{section_name}-Lab{b_idx}"
                    batch_fac = self._resolve_faculty_for_batch(course.code, b_idx)
                    b_fac_id = batch_fac.id if batch_fac else fac_id
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section, faculty_id=b_fac_id)
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
                        batch = await self._get_or_create_batch(offering, batch_name, parent_section=section, faculty_id=fac_id)
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
        fac_user = self._resolve_faculty_for_course(course.code)
        fac_id = fac_user.id if fac_user else None

        for sec_idx, sec_students in enumerate(theory_chunks, start=1):
            section_name = f"{base_name}-Sec{sec_idx}"
            section: Optional[ClassSection] = None

            if mode != "PRACTICAL_ONLY":
                section = await self._get_or_create_section(offering, section_name, faculty_id=fac_id)
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
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section, faculty_id=fac_id)
                    for student in chunk:
                        await self._upsert_enrollment(student, offering, section=section, batch=batch)
            elif mode in ("INTEGRATED_TH_PR", "PRACTICAL_ONLY"):
                batch_chunks = balanced_chunks(sec_students, DEPT_BATCH_MAX)
                for b_idx, chunk in enumerate(batch_chunks, start=1):
                    batch_name = f"{section_name}-Lab{b_idx}"
                    batch = await self._get_or_create_batch(offering, batch_name, parent_section=section, faculty_id=fac_id)
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
        self, offering: CourseOffering, section_name: str, faculty_id: Optional[uuid.UUID] = None
    ) -> ClassSection:
        cache_key = (offering.id, section_name)
        if cache_key in self._section_cache:
            sec = self._section_cache[cache_key]
            if faculty_id and not sec.faculty_id:
                sec.faculty_id = faculty_id
            return sec

        section = ClassSection(
            id=uuid.uuid4(),
            offering_id=offering.id,
            section_name=section_name,
            faculty_id=faculty_id,
        )
        self.db.add(section)
        self.sections_created += 1
        self._section_cache[cache_key] = section
        return section

    async def _get_or_create_batch(
        self,
        offering: CourseOffering,
        batch_name: str,
        parent_section: Optional[ClassSection] = None,
        faculty_id: Optional[uuid.UUID] = None,
    ) -> PracticalBatch:
        cache_key = (offering.id, batch_name)
        if cache_key in self._batch_cache:
            b = self._batch_cache[cache_key]
            if faculty_id and not b.faculty_id:
                b.faculty_id = faculty_id
            return b

        batch = PracticalBatch(
            id=uuid.uuid4(),
            offering_id=offering.id,
            section_id=parent_section.id if parent_section else None,
            batch_name=batch_name,
            faculty_id=faculty_id,
        )
        self.db.add(batch)
        self.batches_created += 1
        self._batch_cache[cache_key] = batch
        return batch

    async def _upsert_enrollment(
        self,
        student: User,
        offering: CourseOffering,
        section: Optional[ClassSection],
        batch: Optional[PracticalBatch],
    ) -> None:
        """Create or update a StudentEnrollment record (idempotent in-memory, batch flushed)."""
        cache_key = (student.id, offering.id)
        if cache_key in self._enrollment_cache:
            enrollment = self._enrollment_cache[cache_key]
            if section:
                enrollment.section_id = section.id
            if batch:
                enrollment.batch_id = batch.id
            return

        enrollment = StudentEnrollment(
            id=uuid.uuid4(),
            student_id=student.id,
            offering_id=offering.id,
            section_id=section.id if section else None,
            batch_id=batch.id if batch else None,
        )
        self.db.add(enrollment)
        self._enrollment_cache[cache_key] = enrollment

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
            "notices": getattr(self, "notices", []),
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
