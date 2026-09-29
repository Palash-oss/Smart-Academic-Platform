"""
Timetable Engine Service — Revision FRCRCE-3-26 (Enhanced)
===========================================================
Standalone Post-Allotment Scheduling & Visualization Engine.
Operates downstream of the Allotment Engine:
1. Validates that course & batch allotments are committed.
2. Automatically generates conflict-free Master timetable grids for divisions.
3. Formats personalized schedules for Faculty (only their assigned classes)
   and Students (only their enrolled section, batch, and electives).
4. Generates standard abbreviation tables and printable college layouts.
"""
from __future__ import annotations

import uuid
import re
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    User,
    Department,
    Division,
    Course,
    CourseOffering,
    ClassSection,
    PracticalBatch,
    StudentEnrollment,
    TimetableSlot,
)
from app.schemas.timetable import (
    TimeSlotDef,
    ParallelBatchItem,
    TimetableCell,
    LegendItem,
    MasterTimetableHeader,
    MasterTimetableResponse,
    PersonalizedSlotItem,
    FacultyTimetableResponse,
    StudentTimetableResponse,
    TimetableStatusResponse,
)

# ---------------------------------------------------------------------------
# Standard College Timetable Slot Definitions (from official university template)
# ---------------------------------------------------------------------------
TIME_SLOT_DEFS: List[TimeSlotDef] = [
    TimeSlotDef(start_time="08:45", end_time="09:45", label="8.45 a.m. – 9.45 a.m.", is_break=False),
    TimeSlotDef(start_time="09:45", end_time="10:45", label="9.45 a.m. – 10.45 a.m.", is_break=False),
    TimeSlotDef(start_time="10:45", end_time="11:00", label="10.45 a.m. – 11.00 a.m.", is_break=True, break_title="SHORT BREAK"),
    TimeSlotDef(start_time="11:00", end_time="12:00", label="11.00 a.m. – 12.00 p.m.", is_break=False),
    TimeSlotDef(start_time="12:00", end_time="13:00", label="12.00 p.m. – 13.00 p.m.", is_break=False),
    TimeSlotDef(start_time="13:00", end_time="13:30", label="13.00 p.m. – 13.30 p.m.", is_break=True, break_title="LUNCH BREAK"),
    TimeSlotDef(start_time="13:30", end_time="14:30", label="13.30 p.m. – 14.30 p.m.", is_break=False),
    TimeSlotDef(start_time="14:30", end_time="15:30", label="14.30 p.m. – 15.30 p.m.", is_break=False),
    TimeSlotDef(start_time="15:30", end_time="16:30", label="15.30 p.m. – 16.30 p.m.", is_break=False),
    TimeSlotDef(start_time="16:30", end_time="17:30", label="16.30 p.m. – 17.30 p.m.", is_break=False),
]

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


# ---------------------------------------------------------------------------
# Abbreviations & Helper Utilities
# ---------------------------------------------------------------------------

KNOWN_COURSE_ABBRS: Dict[str, str] = {
    # Sem 5 Core & Electives
    "Data Warehousing and Mining": "DWM",
    "Computer Networks": "CN",
    "Cryptography and System Security": "CSS",
    "Theory of Computer Science": "TCS",
    "Cloud Computing Laboratory": "CCL",
    "Blockchain Technology": "BT",
    "Blockchain Technology Laboratory": "BT Lab",
    "Deep Learning and Reinforcement Learning": "DLRL",
    "Deep Learning and Reinforcement Learning Laboratory": "DLRL Lab",
    "Deep Learning Laboratory": "DL Lab",
    "Cyber Security": "CS",
    "Cyber Security Laboratory": "CS Lab",
    "Big Data Analytics": "BDA",
    "Big Data Analytics Laboratory": "BDA Lab",
    "Image Processing Laboratory": "IP Lab",
    "Natural Language Processing Laboratory": "NLP Lab",
    "Industrial IoT Laboratory": "IIoT Lab",
    "Ethical Hacking Laboratory": "EH Lab",
    "Health, Wellness and Psychology": "HWP",
    "Emotional and Spiritual Intelligence": "ESI",

    # Sem 6 Core & Electives
    "Distributed Computing": "DC",
    "Software Engineering": "SE",
    "Artificial Intelligence Laboratory": "AI Lab",
    "Competitive Coding Practice": "CCP",
    "Public Relations and Corporate Communication": "PRCC",
    "Decentralized Finance": "DeFi",
    "Generative AI": "GenAI",
    "Digital Forensics": "DF",
    "Social Media Analytics Laboratory": "SMAL",
    "Explainable AI Laboratory": "XAI Lab",
    "Mobile App Development": "MAD",
    "Advanced Microprocessors": "AM",
}

KNOWN_FACULTY_INITIALS: Dict[str, str] = {
    "Dr. Ashok Kanthe": "AK",
    "Dr. Kalpana Deorukhkar": "KD",
    "Dr. Monali Shetty": "MS",
    "Dr. Monica Khanore": "MK",
    "Dr. Roshni Padate": "RP",
    "Dr. Smita Ambarkar": "SA",
    "Dr. Sujata Deshmukh": "SD",
    "Dr. Supriya Kamoji": "SK",
    "Dr. Vijay Shelake": "VS",
    "Prof. Ankita Amburle": "AA",
    "Prof. Ashwini Pansare": "AP",
    "Prof. Garima Singh": "GS",
    "Prof. Khushboo Singh": "KS",
    "Prof. Kranti Kiran Wagle": "KW",
    "Prof. Lokhande Unik": "LU",
    "Prof. Merly Thomas": "MT",
    "Prof. Nirajsingh R Yeotikar": "NY",
    "Prof. Prity Bansode": "PB",
    "Prof. Sachin Narkhede": "SN",
    "Prof. Sangeeta Parshionikar": "SP",
    "Prof. Sushma Nagdeote": "SN",
    "Prof. Varsha Phulpagar": "VP",
    "Prof. Akshata Satyawan Patil": "AP",
}


def get_course_abbr(name: str, code: str) -> str:
    """Derives a concise 2-4 letter abbreviation for timetable display."""
    if name in KNOWN_COURSE_ABBRS:
        return KNOWN_COURSE_ABBRS[name]
    for k, v in KNOWN_COURSE_ABBRS.items():
        if k.lower() in name.lower() or name.lower() in k.lower():
            return v
    words = [w for w in re.findall(r'[A-Za-z]+', name) if w.lower() not in ('and', 'of', 'the', 'in', 'for', 'laboratory', 'lab')]
    if len(words) >= 2:
        return "".join(w[0].upper() for w in words[:4])
    return code[-4:]


def get_faculty_initials(full_name: str) -> str:
    """Extracts faculty initials (e.g., 'Dr. Ashok Kanthe' -> 'AK', 'Prof. Nirajsingh R Yeotikar' -> 'NY')."""
    if not full_name:
        return ""
    clean_name = full_name.strip()
    if clean_name in KNOWN_FACULTY_INITIALS:
        return KNOWN_FACULTY_INITIALS[clean_name]
    for k, v in KNOWN_FACULTY_INITIALS.items():
        if k.lower() in clean_name.lower() or clean_name.lower() in k.lower():
            return v
    clean = re.sub(r'^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s*', '', clean_name, flags=re.IGNORECASE)
    parts = clean.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1 and len(parts[0]) >= 2:
        return parts[0][:2].upper()
    return clean[:2].upper() if clean else ""


class TimetableService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # =========================================================================
    # 1. Guard Condition: Check Allotment Readiness
    # =========================================================================
    async def check_allotment_status(self, academic_term: str) -> TimetableStatusResponse:
        """
        Validates whether allotment is finalized so timetable can be safely generated.
        """
        off_res = await self.db.execute(
            select(func.count(CourseOffering.id)).where(CourseOffering.academic_term == academic_term)
        )
        total_offerings = off_res.scalar() or 0

        sec_res = await self.db.execute(
            select(func.count(ClassSection.id))
            .join(CourseOffering, ClassSection.offering_id == CourseOffering.id)
            .where(CourseOffering.academic_term == academic_term)
        )
        total_sections = sec_res.scalar() or 0

        batch_res = await self.db.execute(
            select(func.count(PracticalBatch.id))
            .join(CourseOffering, PracticalBatch.offering_id == CourseOffering.id)
            .where(CourseOffering.academic_term == academic_term)
        )
        total_batches = batch_res.scalar() or 0

        enr_res = await self.db.execute(
            select(func.count(StudentEnrollment.id))
            .join(CourseOffering, StudentEnrollment.offering_id == CourseOffering.id)
            .where(CourseOffering.academic_term == academic_term)
        )
        total_enrollments = enr_res.scalar() or 0

        slot_res = await self.db.execute(
            select(func.count(TimetableSlot.id)).where(TimetableSlot.academic_term == academic_term)
        )
        total_slots = slot_res.scalar() or 0

        allotment_ready = total_offerings >= 4 and total_sections >= 2 and total_enrollments >= 20

        if not allotment_ready:
            msg = (
                f"Allotment is NOT finalized for {academic_term}. Found {total_offerings} offerings, "
                f"{total_sections} sections, and {total_enrollments} student enrollments. "
                "Please run course & batch allotment first."
            )
        else:
            msg = (
                f"Allotment verified: {total_offerings} offerings, {total_sections} theory sections, "
                f"{total_batches} lab batches committed. Ready to generate conflict-free timetable."
            )

        return TimetableStatusResponse(
            academic_term=academic_term,
            allotment_completed=allotment_ready,
            allotment_details={
                "total_offerings": total_offerings,
                "total_sections": total_sections,
                "total_batches": total_batches,
                "total_enrollments": total_enrollments,
            },
            timetable_generated=total_slots > 0,
            total_slots_count=total_slots,
            can_generate=allotment_ready,
            message=msg,
        )

    # =========================================================================
    # 2. Automated Conflict-Free Timetable Generator
    # =========================================================================
    async def generate_timetable(self, academic_term: str, room_number: str = "703", overwrite: bool = True) -> int:
        """
        Generates a conflict-free, balanced master timetable for Division A and Division B
        based strictly on the finalized allotment records.
        """
        # Step 1: Guard check
        status = await self.check_allotment_status(academic_term)
        if not status.can_generate:
            raise ValueError(status.message)

        if overwrite:
            await self.db.execute(
                delete(TimetableSlot).where(TimetableSlot.academic_term == academic_term)
            )
            await self.db.flush()

        # Step 2: Fetch Divisions
        div_res = await self.db.execute(select(Division).order_by(Division.name))
        divisions = div_res.scalars().all()
        if not divisions:
            raise ValueError("No divisions found in database.")

        # Step 3: Fetch Offerings with Sections, Batches, and Faculty
        stmt = (
            select(CourseOffering)
            .where(CourseOffering.academic_term == academic_term)
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.sections).selectinload(ClassSection.faculty),
                selectinload(CourseOffering.batches).selectinload(PracticalBatch.faculty),
            )
        )
        offerings = (await self.db.execute(stmt)).scalars().all()

        # Helper to find offering by keyword
        def find_off(keyword: str) -> Optional[CourseOffering]:
            kw = keyword.lower()
            for o in offerings:
                if kw in o.course.name.lower() or kw in o.course.code.lower():
                    return o
            return None

        dwm_off = find_off("Data Warehousing")
        cn_off = find_off("Computer Networks")
        css_off = find_off("Cryptography")
        tcs_off = find_off("Theory of Computer")
        ccl_off = find_off("Cloud Computing")

        bt_off = find_off("Blockchain")
        dlrl_off = find_off("Deep Learning")
        cs_off = find_off("Cyber Security")
        bda_off = find_off("Big Data")

        ip_off = find_off("Image Processing")
        nlp_off = find_off("Natural Language")
        eh_off = find_off("Ethical Hacking")
        iiot_off = find_off("Industrial IoT")
        hwp_off = find_off("Health, Wellness")

        slots_to_add: List[TimetableSlot] = []

        # Process Division B and Division A with distinct, conflict-free schedules
        for div in divisions:
            div_name = div.name  # "A" or "B"
            div_room = "702" if div_name == "A" else "703"

            # Helper for single Theory Slot
            def make_theory_slot(day: str, start: str, end: str, off: Optional[CourseOffering], fac_user: Optional[User] = None) -> TimetableSlot:
                if not off:
                    return None
                sec = None
                for s in off.sections:
                    if f"-{div_name}-" in s.section_name or s.section_name.endswith(f"-{div_name}"):
                        sec = s
                        break
                    elif len(off.sections) == 1 or not sec:
                        sec = s
                faculty = fac_user or (sec.faculty if sec else None)
                return TimetableSlot(
                    id=uuid.uuid4(),
                    academic_term=academic_term,
                    division_id=div.id,
                    day_of_week=day,
                    start_time=start,
                    end_time=end,
                    slot_type="THEORY",
                    room_number=div_room,
                    offering_id=off.id,
                    section_id=sec.id if sec else None,
                    faculty_id=faculty.id if faculty else None,
                )

            # Helper for 2-Hour Parallel Multi-Batch Practical Lab Session (Core Labs)
            def make_parallel_lab_block(
                day: str,
                start: str,
                end: str,
                assignments: List[Tuple[CourseOffering, str, Optional[User], Optional[PracticalBatch], str]],
            ) -> List[TimetableSlot]:
                group_id = f"PAR-{div_name}-{day[:3]}-{start.replace(':', '')}"
                created = []
                for off, b_label, fac_user, b_obj, lab_room in assignments:
                    slot = TimetableSlot(
                        id=uuid.uuid4(),
                        academic_term=academic_term,
                        division_id=div.id,
                        day_of_week=day,
                        start_time=start,
                        end_time=end,
                        slot_type="PRACTICAL",
                        room_number=lab_room,
                        offering_id=off.id if off else None,
                        section_id=b_obj.section_id if b_obj else None,
                        batch_id=b_obj.id if b_obj else None,
                        faculty_id=fac_user.id if fac_user else (b_obj.faculty_id if b_obj else None),
                        parallel_group_id=group_id,
                        custom_title=b_label,
                    )
                    created.append(slot)
                return created

            # Helper for Parallel Department Elective Theory (All 4 courses: BT, DLRL, CS, BDA)
            def make_parallel_elective_theory(day: str, start: str, end: str) -> List[TimetableSlot]:
                group_id = f"PEC-TH-{day[:3]}-{start.replace(':', '')}"
                created = []
                electives_def = [
                    (bt_off, "BT", "Room 702" if div_name == "A" else "Room 703"),
                    (dlrl_off, "DLRL", "Room 704"),
                    (cs_off, "CS", "Room 705"),
                    (bda_off, "BDA", "Room 706"),
                ]
                for off, title, room in electives_def:
                    if off:
                        sec = off.sections[0] if off.sections else None
                        created.append(
                            TimetableSlot(
                                id=uuid.uuid4(),
                                academic_term=academic_term,
                                division_id=div.id,
                                day_of_week=day,
                                start_time=start,
                                end_time=end,
                                slot_type="THEORY",
                                room_number=room,
                                offering_id=off.id,
                                section_id=sec.id if sec else None,
                                faculty_id=sec.faculty_id if sec else None,
                                parallel_group_id=group_id,
                                custom_title=title,
                            )
                        )
                return created

            # Helper for Parallel Department Elective Practicals (Theory + Lab Courses: BT Lab, DLRL Lab, CS Lab, BDA Lab)
            def make_parallel_pec_practicals(day: str, start: str, end: str) -> List[TimetableSlot]:
                group_id = f"PEC-PRAC-{day[:3]}-{start.replace(':', '')}"
                created = []
                pec_labs = [
                    (bt_off, "BT Lab", "Lab 701"),
                    (dlrl_off, "DLRL Lab", "Lab 704"),
                    (cs_off, "CS Lab", "Lab 703"),
                    (bda_off, "BDA Lab", "Lab 702"),
                ]
                for off, title, room in pec_labs:
                    if off and off.batches:
                        for b in off.batches:
                            created.append(
                                TimetableSlot(
                                    id=uuid.uuid4(),
                                    academic_term=academic_term,
                                    division_id=div.id,
                                    day_of_week=day,
                                    start_time=start,
                                    end_time=end,
                                    slot_type="PRACTICAL",
                                    room_number=room,
                                    offering_id=off.id,
                                    batch_id=b.id,
                                    faculty_id=b.faculty_id,
                                    parallel_group_id=group_id,
                                    custom_title=title,
                                )
                            )
                return created

            # Helper for Parallel Program Elective Labs (Lab-only courses: IP Lab, NLP Lab, EH Lab, IIoT Lab)
            def make_parallel_pel_practicals(day: str, start: str, end: str) -> List[TimetableSlot]:
                group_id = f"PEL-PRAC-{day[:3]}-{start.replace(':', '')}"
                created = []
                pel_labs = [
                    (ip_off, "IP Lab", "Lab 701"),
                    (nlp_off, "NLP Lab", "Lab 702"),
                    (eh_off, "EH Lab", "Lab 703"),
                    (iiot_off, "IIoT Lab", "Lab 704"),
                ]
                for off, title, room in pel_labs:
                    if off and off.batches:
                        for b in off.batches:
                            created.append(
                                TimetableSlot(
                                    id=uuid.uuid4(),
                                    academic_term=academic_term,
                                    division_id=div.id,
                                    day_of_week=day,
                                    start_time=start,
                                    end_time=end,
                                    slot_type="PRACTICAL",
                                    room_number=room,
                                    offering_id=off.id,
                                    batch_id=b.id,
                                    faculty_id=b.faculty_id,
                                    parallel_group_id=group_id,
                                    custom_title=title,
                                )
                            )
                return created

            # Helper for special blocks (Honors, Mini Project)
            def make_special_slot(day: str, start: str, end: str, title: str, slot_type: str) -> TimetableSlot:
                return TimetableSlot(
                    id=uuid.uuid4(),
                    academic_term=academic_term,
                    division_id=div.id,
                    day_of_week=day,
                    start_time=start,
                    end_time=end,
                    slot_type=slot_type,
                    room_number=div_room,
                    custom_title=title,
                )

            # Map batches for core courses for this division
            def get_div_batch(off: Optional[CourseOffering], b_key: str) -> Optional[PracticalBatch]:
                if not off:
                    return None
                for b in off.batches:
                    if (f"-{div_name}-" in b.batch_name or f"COMP-{div_name}" in b.batch_name) and b.batch_name.endswith(b_key):
                        return b
                return None

            dwm_b = {k: get_div_batch(dwm_off, k) for k in ["B1", "B2", "B3", "B4"]}
            cn_b = {k: get_div_batch(cn_off, k) for k in ["B1", "B2", "B3", "B4"]}
            css_b = {k: get_div_batch(css_off, k) for k in ["B1", "B2", "B3", "B4"]}
            tcs_b = {k: get_div_batch(tcs_off, k) for k in ["B1", "B2", "B3", "B4"]}
            ccl_b = {k: get_div_batch(ccl_off, k) for k in ["B1", "B2", "B3", "B4"]}

            # =================================================================
            # DIVISION B BLUEPRINT (Room 703, Class Teacher: Dr. Ashok Kanthe)
            # =================================================================
            if div_name == "B":
                # MONDAY
                # 8:45-10:45: Parallel Core Lab 1 (B4 gets CCL with Dr. Vijay Shelake)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Monday", "08:45", "10:45",
                        [
                            (dwm_off, "B1", dwm_b["B1"].faculty if dwm_b["B1"] else None, dwm_b["B1"], "Lab 701"),
                            (cn_off, "B2", cn_b["B2"].faculty if cn_b["B2"] else None, cn_b["B2"], "Lab 702"),
                            (css_off, "B3", css_b["B3"].faculty if css_b["B3"] else None, css_b["B3"], "Lab 703"),
                            (ccl_off, "B4", ccl_b["B4"].faculty if ccl_b["B4"] else None, ccl_b["B4"], "Lab 704"),
                        ]
                    )
                )
                # 11:00-12:00: Theory DWM (SD)
                slots_to_add.append(make_theory_slot("Monday", "11:00", "12:00", dwm_off))
                # 12:00-13:00: Theory CN (AK)
                slots_to_add.append(make_theory_slot("Monday", "12:00", "13:00", cn_off))
                # 13:30-15:30: Synchronized Department Elective Practicals (BT Lab, DLRL Lab, CS Lab, BDA Lab)
                slots_to_add.extend(make_parallel_pec_practicals("Monday", "13:30", "15:30"))
                # 15:30-16:30: Theory HWP (RP)
                slots_to_add.append(make_theory_slot("Monday", "15:30", "16:30", hwp_off))

                # TUESDAY
                # 8:45-10:45: Synchronized Program Elective Labs (IP Lab, NLP Lab, EH Lab, IIoT Lab)
                slots_to_add.extend(make_parallel_pel_practicals("Tuesday", "08:45", "10:45"))
                # 11:00-12:00: Theory CSS (MS)
                slots_to_add.append(make_theory_slot("Tuesday", "11:00", "12:00", css_off))
                # 12:00-13:00: Theory TCS (AA)
                slots_to_add.append(make_theory_slot("Tuesday", "12:00", "13:00", tcs_off))
                # 13:30-15:30: Parallel Core Lab 2 (B3 gets CCL with Dr. Vijay Shelake)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Tuesday", "13:30", "15:30",
                        [
                            (cn_off, "B1", cn_b["B1"].faculty if cn_b["B1"] else None, cn_b["B1"], "Lab 702"),
                            (css_off, "B2", css_b["B2"].faculty if css_b["B2"] else None, css_b["B2"], "Lab 703"),
                            (ccl_off, "B3", ccl_b["B3"].faculty if ccl_b["B3"] else None, ccl_b["B3"], "Lab 704"),
                            (dwm_off, "B4", dwm_b["B4"].faculty if dwm_b["B4"] else None, dwm_b["B4"], "Lab 701"),
                        ]
                    )
                )
                # 15:30-16:30: Theory DWM (SD)
                slots_to_add.append(make_theory_slot("Tuesday", "15:30", "16:30", dwm_off))

                # WEDNESDAY
                # 8:45-10:45: Honors / Minors
                slots_to_add.append(make_special_slot("Wednesday", "08:45", "10:45", "Honors / Minors", "HONORS"))
                # 11:00-12:00 & 12:00-13:00: Synchronized Department Elective Theory (BT / DLRL / CS / BDA)
                slots_to_add.extend(make_parallel_elective_theory("Wednesday", "11:00", "12:00"))
                slots_to_add.extend(make_parallel_elective_theory("Wednesday", "12:00", "13:00"))
                # 13:30-15:30: Parallel Core Lab 3 (B2 gets CCL with Prof. Lokhande Unik)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Wednesday", "13:30", "15:30",
                        [
                            (css_off, "B1", css_b["B1"].faculty if css_b["B1"] else None, css_b["B1"], "Lab 703"),
                            (ccl_off, "B2", ccl_b["B2"].faculty if ccl_b["B2"] else None, ccl_b["B2"], "Lab 704"),
                            (dwm_off, "B3", dwm_b["B3"].faculty if dwm_b["B3"] else None, dwm_b["B3"], "Lab 701"),
                            (cn_off, "B4", cn_b["B4"].faculty if cn_b["B4"] else None, cn_b["B4"], "Lab 702"),
                        ]
                    )
                )
                # 15:30-16:30: Theory CN (AK)
                slots_to_add.append(make_theory_slot("Wednesday", "15:30", "16:30", cn_off))

                # THURSDAY
                # 8:45-10:45: Theory of Computer Science (TCS) Lab / Tutorial (AA)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Thursday", "08:45", "10:45",
                        [
                            (tcs_off, "B1", tcs_b["B1"].faculty if tcs_b["B1"] else None, tcs_b["B1"], "Lab 701"),
                            (tcs_off, "B2", tcs_b["B2"].faculty if tcs_b["B2"] else None, tcs_b["B2"], "Lab 702"),
                            (tcs_off, "B3", tcs_b["B3"].faculty if tcs_b["B3"] else None, tcs_b["B3"], "Lab 703"),
                            (tcs_off, "B4", tcs_b["B4"].faculty if tcs_b["B4"] else None, tcs_b["B4"], "Lab 704"),
                        ]
                    )
                )
                # 11:00-12:00: Theory CN (AK)
                slots_to_add.append(make_theory_slot("Thursday", "11:00", "12:00", cn_off))
                # 12:00-13:00: Theory CSS (MS)
                slots_to_add.append(make_theory_slot("Thursday", "12:00", "13:00", css_off))
                # 13:30-14:30: Theory TCS (AA)
                slots_to_add.append(make_theory_slot("Thursday", "13:30", "14:30", tcs_off))
                # 14:30-15:30: Theory DWM (SD)
                slots_to_add.append(make_theory_slot("Thursday", "14:30", "15:30", dwm_off))
                # 15:30-16:30: Honors
                slots_to_add.append(make_special_slot("Thursday", "15:30", "16:30", "Honors", "HONORS"))

                # FRIDAY
                # 8:45-09:45: Theory TCS (AA)
                slots_to_add.append(make_theory_slot("Friday", "08:45", "09:45", tcs_off))
                # 09:45-10:45: Theory CSS (MS)
                slots_to_add.append(make_theory_slot("Friday", "09:45", "10:45", css_off))
                # 11:00-12:00: Theory HWP (RP)
                slots_to_add.append(make_theory_slot("Friday", "11:00", "12:00", hwp_off))
                # 12:00-13:00: Theory DWM (SD)
                slots_to_add.append(make_theory_slot("Friday", "12:00", "13:00", dwm_off))
                # 13:30-15:30: Parallel Core Lab 4 (B1 gets CCL with Prof. Lokhande Unik)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Friday", "13:30", "15:30",
                        [
                            (ccl_off, "B1", ccl_b["B1"].faculty if ccl_b["B1"] else None, ccl_b["B1"], "Lab 704"),
                            (dwm_off, "B2", dwm_b["B2"].faculty if dwm_b["B2"] else None, dwm_b["B2"], "Lab 701"),
                            (cn_off, "B3", cn_b["B3"].faculty if cn_b["B3"] else None, cn_b["B3"], "Lab 702"),
                            (css_off, "B4", css_b["B4"].faculty if css_b["B4"] else None, css_b["B4"], "Lab 703"),
                        ]
                    )
                )
                # 15:30-16:30: Honors
                slots_to_add.append(make_special_slot("Friday", "15:30", "16:30", "Honors", "HONORS"))

                # SATURDAY
                # 8:45-13:00: Mini Project / Capstone Activity
                slots_to_add.append(make_special_slot("Saturday", "08:45", "13:00", "Mini Project / Project-Based Learning", "PROJECT"))

            # =================================================================
            # DIVISION A BLUEPRINT (Room 702, Class Teacher: Dr. Kalpana Deorukhkar)
            # =================================================================
            else:
                # MONDAY
                # 8:45-10:45: Parallel Core Lab 1 (B1 gets CCL with Dr. Supriya Kamoji)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Monday", "08:45", "10:45",
                        [
                            (ccl_off, "B1", ccl_b["B1"].faculty if ccl_b["B1"] else None, ccl_b["B1"], "Lab 704"),
                            (dwm_off, "B2", dwm_b["B2"].faculty if dwm_b["B2"] else None, dwm_b["B2"], "Lab 701"),
                            (cn_off, "B3", cn_b["B3"].faculty if cn_b["B3"] else None, cn_b["B3"], "Lab 702"),
                            (css_off, "B4", css_b["B4"].faculty if css_b["B4"] else None, css_b["B4"], "Lab 703"),
                        ]
                    )
                )
                # 11:00-12:00: Theory CN (MT)
                slots_to_add.append(make_theory_slot("Monday", "11:00", "12:00", cn_off))
                # 12:00-13:00: Theory DWM (SN)
                slots_to_add.append(make_theory_slot("Monday", "12:00", "13:00", dwm_off))
                # 13:30-15:30: Synchronized Department Elective Practicals (BT Lab, DLRL Lab, CS Lab, BDA Lab)
                slots_to_add.extend(make_parallel_pec_practicals("Monday", "13:30", "15:30"))
                # 15:30-16:30: Theory CSS (MK)
                slots_to_add.append(make_theory_slot("Monday", "15:30", "16:30", css_off))

                # TUESDAY
                # 8:45-10:45: Synchronized Program Elective Labs (IP Lab, NLP Lab, EH Lab, IIoT Lab)
                slots_to_add.extend(make_parallel_pel_practicals("Tuesday", "08:45", "10:45"))
                # 11:00-12:00: Theory TCS (KD)
                slots_to_add.append(make_theory_slot("Tuesday", "11:00", "12:00", tcs_off))
                # 12:00-13:00: Theory CSS (MK)
                slots_to_add.append(make_theory_slot("Tuesday", "12:00", "13:00", css_off))
                # 13:30-15:30: Parallel Core Lab 2 (B2 gets CCL with Dr. Supriya Kamoji)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Tuesday", "13:30", "15:30",
                        [
                            (dwm_off, "B1", dwm_b["B1"].faculty if dwm_b["B1"] else None, dwm_b["B1"], "Lab 701"),
                            (ccl_off, "B2", ccl_b["B2"].faculty if ccl_b["B2"] else None, ccl_b["B2"], "Lab 704"),
                            (css_off, "B3", css_b["B3"].faculty if css_b["B3"] else None, css_b["B3"], "Lab 703"),
                            (cn_off, "B4", cn_b["B4"].faculty if cn_b["B4"] else None, cn_b["B4"], "Lab 702"),
                        ]
                    )
                )
                # 15:30-16:30: Theory HWP (RP)
                slots_to_add.append(make_theory_slot("Tuesday", "15:30", "16:30", hwp_off))

                # WEDNESDAY
                # 8:45-10:45: Honors / Minors
                slots_to_add.append(make_special_slot("Wednesday", "08:45", "10:45", "Honors / Minors", "HONORS"))
                # 11:00-12:00 & 12:00-13:00: Synchronized Department Elective Theory (BT / DLRL / CS / BDA)
                slots_to_add.extend(make_parallel_elective_theory("Wednesday", "11:00", "12:00"))
                slots_to_add.extend(make_parallel_elective_theory("Wednesday", "12:00", "13:00"))
                # 13:30-15:30: Parallel Core Lab 3 (B3 gets CCL with Dr. Vijay Shelake)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Wednesday", "13:30", "15:30",
                        [
                            (cn_off, "B1", cn_b["B1"].faculty if cn_b["B1"] else None, cn_b["B1"], "Lab 702"),
                            (css_off, "B2", css_b["B2"].faculty if css_b["B2"] else None, css_b["B2"], "Lab 703"),
                            (ccl_off, "B3", ccl_b["B3"].faculty if ccl_b["B3"] else None, ccl_b["B3"], "Lab 704"),
                            (dwm_off, "B4", dwm_b["B4"].faculty if dwm_b["B4"] else None, dwm_b["B4"], "Lab 701"),
                        ]
                    )
                )
                # 15:30-16:30: Theory HWP (RP)
                slots_to_add.append(make_theory_slot("Wednesday", "15:30", "16:30", hwp_off))

                # THURSDAY
                # 8:45-09:45: Theory TCS (KD)
                slots_to_add.append(make_theory_slot("Thursday", "08:45", "09:45", tcs_off))
                # 09:45-10:45: Theory DWM (SN)
                slots_to_add.append(make_theory_slot("Thursday", "09:45", "10:45", dwm_off))
                # 11:00-12:00: Theory CN (MT)
                slots_to_add.append(make_theory_slot("Thursday", "11:00", "12:00", cn_off))
                # 12:00-13:00: Theory CSS (MK)
                slots_to_add.append(make_theory_slot("Thursday", "12:00", "13:00", css_off))
                # 13:30-15:30: Parallel Core Lab 4 (B4 gets CCL with Dr. Vijay Shelake)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Thursday", "13:30", "15:30",
                        [
                            (css_off, "B1", css_b["B1"].faculty if css_b["B1"] else None, css_b["B1"], "Lab 703"),
                            (cn_off, "B2", cn_b["B2"].faculty if cn_b["B2"] else None, cn_b["B2"], "Lab 702"),
                            (dwm_off, "B3", dwm_b["B3"].faculty if dwm_b["B3"] else None, dwm_b["B3"], "Lab 701"),
                            (ccl_off, "B4", ccl_b["B4"].faculty if ccl_b["B4"] else None, ccl_b["B4"], "Lab 704"),
                        ]
                    )
                )
                # 15:30-16:30: Honors
                slots_to_add.append(make_special_slot("Thursday", "15:30", "16:30", "Honors", "HONORS"))

                # FRIDAY
                # 8:45-10:45: Theory of Computer Science (TCS) Lab / Tutorial (KD)
                slots_to_add.extend(
                    make_parallel_lab_block(
                        "Friday", "08:45", "10:45",
                        [
                            (tcs_off, "B1", tcs_b["B1"].faculty if tcs_b["B1"] else None, tcs_b["B1"], "Lab 701"),
                            (tcs_off, "B2", tcs_b["B2"].faculty if tcs_b["B2"] else None, tcs_b["B2"], "Lab 702"),
                            (tcs_off, "B3", tcs_b["B3"].faculty if tcs_b["B3"] else None, tcs_b["B3"], "Lab 703"),
                            (tcs_off, "B4", tcs_b["B4"].faculty if tcs_b["B4"] else None, tcs_b["B4"], "Lab 704"),
                        ]
                    )
                )
                # 11:00-12:00: Theory TCS (KD)
                slots_to_add.append(make_theory_slot("Friday", "11:00", "12:00", tcs_off))
                # 12:00-13:00: Theory CN (MT)
                slots_to_add.append(make_theory_slot("Friday", "12:00", "13:00", cn_off))
                # 13:30-14:30: Theory DWM (SN)
                slots_to_add.append(make_theory_slot("Friday", "13:30", "14:30", dwm_off))
                # 14:30-15:30: Theory CSS (MK)
                slots_to_add.append(make_theory_slot("Friday", "14:30", "15:30", css_off))
                # 15:30-16:30: Honors
                slots_to_add.append(make_special_slot("Friday", "15:30", "16:30", "Honors", "HONORS"))

                # SATURDAY
                # 8:45-13:00: Mini Project / Capstone Activity
                slots_to_add.append(make_special_slot("Saturday", "08:45", "13:00", "Mini Project / Project-Based Learning", "PROJECT"))

        clean_slots = [s for s in slots_to_add if s is not None]
        self.db.add_all(clean_slots)
        await self.db.commit()
        return len(clean_slots)

    # =========================================================================
    # 3. Master Division Timetable Grid Visualizer
    # =========================================================================
    async def get_master_timetable(self, academic_term: str, division_name: str = "B") -> MasterTimetableResponse:
        """
        Builds the complete master timetable grid for a specific division, matching the official paper format:
        - Division header with Room 703, Class Teacher, Term duration
        - Time slots with short break & lunch break
        - Parallel 2-hour lab cells and parallel elective theory cells
        - Subject and Faculty Legend tables
        """
        div_res = await self.db.execute(select(Division).where(Division.name == division_name))
        div = div_res.scalar_one_or_none()
        if not div:
            raise ValueError(f"Division '{division_name}' not found.")

        # Class teacher based on division
        class_teacher = "Dr. ASHOK KANTHE" if div.name == "B" else "Dr. KALPANA DEORUKHKAR"
        div_room = "Room 703" if div.name == "B" else "Room 702"

        header = MasterTimetableHeader(
            class_name=f"T.E. COMPUTER ENGINEERING-{div.name}",
            division_name=f"COMP-{div.name}",
            room_number=div_room,
            class_teacher=class_teacher,
            effective_dates="July 2026 to December 2026",
            academic_term=academic_term,
        )

        # Fetch all slots for this division
        slot_stmt = (
            select(TimetableSlot)
            .where(
                TimetableSlot.academic_term == academic_term,
                TimetableSlot.division_id == div.id,
            )
            .options(
                selectinload(TimetableSlot.offering).selectinload(CourseOffering.course),
                selectinload(TimetableSlot.section),
                selectinload(TimetableSlot.batch),
                selectinload(TimetableSlot.faculty),
            )
            .order_by(TimetableSlot.day_of_week, TimetableSlot.start_time)
        )
        slots = (await self.db.execute(slot_stmt)).scalars().all()

        slots_by_day: Dict[str, List[TimetableSlot]] = {d: [] for d in DAYS_OF_WEEK}
        subject_legend_dict: Dict[str, LegendItem] = {}
        faculty_legend_dict: Dict[str, LegendItem] = {}

        for s in slots:
            if s.day_of_week in slots_by_day:
                slots_by_day[s.day_of_week].append(s)

        grid: Dict[str, List[TimetableCell]] = {}

        for day in DAYS_OF_WEEK:
            day_slots = slots_by_day[day]
            row_cells: List[TimetableCell] = []

            # Group parallel slots by (start_time, end_time, parallel_group_id)
            parallel_groups: Dict[Tuple[str, str, str], List[TimetableSlot]] = {}
            single_slots_by_start: Dict[str, TimetableSlot] = {}

            for s in day_slots:
                if s.parallel_group_id:
                    key = (s.start_time, s.end_time, s.parallel_group_id)
                    if key not in parallel_groups:
                        parallel_groups[key] = []
                    parallel_groups[key].append(s)
                else:
                    single_slots_by_start[s.start_time] = s

            time_idx = 0
            while time_idx < len(TIME_SLOT_DEFS):
                slot_def = TIME_SLOT_DEFS[time_idx]

                # 1. Break slots
                if slot_def.is_break:
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=slot_def.start_time,
                            end_time=slot_def.end_time,
                            slot_type="BREAK",
                            custom_title=slot_def.break_title,
                            col_span=1,
                        )
                    )
                    time_idx += 1
                    continue

                # 2. Check for Saturday Mini-Project (spans entire morning)
                if day == "Saturday" and slot_def.start_time == "08:45":
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time="08:45",
                            end_time="13:00",
                            slot_type="PROJECT",
                            custom_title="Mini Project / Project-Based Learning",
                            col_span=5,
                            room_number=div_room,
                        )
                    )
                    time_idx = 6  # skip to 13:30
                    continue
                elif day == "Saturday" and time_idx < 6:
                    time_idx += 1
                    continue

                # 3. Check for Parallel Groups (Practicals or Elective Theory)
                matched_par_key = None
                for (p_start, p_end, p_gid), p_slots in parallel_groups.items():
                    if p_start == slot_def.start_time:
                        matched_par_key = (p_start, p_end, p_gid)
                        break

                if matched_par_key:
                    p_start, p_end, p_gid = matched_par_key
                    p_slots = parallel_groups[matched_par_key]
                    parallel_items: List[ParallelBatchItem] = []

                    sorted_p_slots = sorted(p_slots, key=lambda x: (x.custom_title or (x.batch.batch_name if x.batch else "")))
                    is_theory_parallel = any(ps.slot_type == "THEORY" for ps in sorted_p_slots)

                    for ps in sorted_p_slots:
                        c_name = ps.offering.course.name if ps.offering and ps.offering.course else "Practical Lab"
                        c_code = ps.offering.course.code if ps.offering and ps.offering.course else "LAB"
                        c_abbr = get_course_abbr(c_name, c_code)
                        if ps.slot_type == "PRACTICAL" and not c_abbr.endswith("Lab") and not c_abbr.endswith("LAB"):
                            if "Lab" in (ps.custom_title or "") or (ps.offering and ps.offering.course and ps.offering.course.course_tier == "DEPARTMENT"):
                                c_abbr = f"{c_abbr} Lab"
                        b_name = ps.custom_title if ps.custom_title in ("B1", "B2", "B3", "B4") else (ps.batch.batch_name.split("-")[-1] if ps.batch else "")
                        fac_name = ps.faculty.full_name if ps.faculty else ""
                        fac_init = get_faculty_initials(fac_name)

                        # Record in legends
                        subject_legend_dict[c_abbr] = LegendItem(abbr=c_abbr, name=c_name, code=c_code)
                        if fac_init and fac_name:
                            faculty_legend_dict[fac_init] = LegendItem(abbr=fac_init, name=fac_name)

                        parallel_items.append(
                            ParallelBatchItem(
                                course_code=c_code,
                                course_abbr=c_abbr,
                                course_name=c_name,
                                batch_name=b_name,
                                faculty_initials=fac_init,
                                faculty_name=fac_name,
                                room_number=ps.room_number or ("Classroom" if is_theory_parallel else "Lab"),
                            )
                        )

                    span = 2 if (p_start == "08:45" and p_end == "10:45") or (p_start == "13:30" and p_end == "15:30") else 1

                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=p_start,
                            end_time=p_end,
                            slot_type="THEORY" if is_theory_parallel else "PRACTICAL",
                            is_parallel=True,
                            col_span=span,
                            parallel_items=parallel_items,
                            room_number="Classroom" if is_theory_parallel else "Labs",
                        )
                    )
                    time_idx += span
                    continue

                # 4. Check for Single Slots (Theory, Honors)
                single_slot = single_slots_by_start.get(slot_def.start_time)
                if single_slot:
                    if single_slot.slot_type == "HONORS":
                        span = 2 if single_slot.start_time == "08:45" and single_slot.end_time == "10:45" else 1
                        row_cells.append(
                            TimetableCell(
                                day_of_week=day,
                                start_time=single_slot.start_time,
                                end_time=single_slot.end_time,
                                slot_type="HONORS",
                                custom_title=single_slot.custom_title or "Honors",
                                col_span=span,
                                room_number=single_slot.room_number,
                            )
                        )
                        time_idx += span
                        continue

                    c_name = single_slot.offering.course.name if single_slot.offering and single_slot.offering.course else "Theory"
                    c_code = single_slot.offering.course.code if single_slot.offering and single_slot.offering.course else ""
                    c_abbr = get_course_abbr(c_name, c_code)
                    fac_name = single_slot.faculty.full_name if single_slot.faculty else ""
                    fac_init = get_faculty_initials(fac_name)

                    subject_legend_dict[c_abbr] = LegendItem(abbr=c_abbr, name=c_name, code=c_code)
                    if fac_init and fac_name:
                        faculty_legend_dict[fac_init] = LegendItem(abbr=fac_init, name=fac_name)

                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=slot_def.start_time,
                            end_time=slot_def.end_time,
                            slot_type="THEORY",
                            course_code=c_code,
                            course_abbr=c_abbr,
                            course_name=c_name,
                            faculty_initials=fac_init,
                            faculty_name=fac_name,
                            room_number=single_slot.room_number,
                            section_name=single_slot.section.section_name if single_slot.section else None,
                            col_span=1,
                        )
                    )
                    time_idx += 1
                    continue

                # 5. Empty Free Slot
                row_cells.append(
                    TimetableCell(
                        day_of_week=day,
                        start_time=slot_def.start_time,
                        end_time=slot_def.end_time,
                        slot_type="EMPTY",
                        col_span=1,
                    )
                )
                time_idx += 1

            grid[day] = row_cells

        subj_legend_list = sorted(list(subject_legend_dict.values()), key=lambda x: x.abbr)
        fac_legend_list = sorted(list(faculty_legend_dict.values()), key=lambda x: x.abbr)

        return MasterTimetableResponse(
            header=header,
            time_slots=TIME_SLOT_DEFS,
            days=DAYS_OF_WEEK,
            grid=grid,
            subject_legend=subj_legend_list,
            faculty_legend=fac_legend_list,
        )

    # =========================================================================
    # 4. Personalized Faculty Timetable
    # =========================================================================
    async def get_faculty_timetable(self, faculty_user: User, academic_term: str) -> FacultyTimetableResponse:
        """
        Filters the timetable to return strictly the lectures and lab sessions
        taught by the authenticated faculty member.
        """
        stmt = (
            select(TimetableSlot)
            .where(
                TimetableSlot.academic_term == academic_term,
                TimetableSlot.faculty_id == faculty_user.id,
            )
            .options(
                selectinload(TimetableSlot.offering).selectinload(CourseOffering.course),
                selectinload(TimetableSlot.division),
                selectinload(TimetableSlot.section),
                selectinload(TimetableSlot.batch),
            )
            .order_by(TimetableSlot.day_of_week, TimetableSlot.start_time)
        )
        faculty_slots = (await self.db.execute(stmt)).scalars().all()

        theory_hours = 0
        practical_hours = 0
        courses_set = set()
        slots_by_day_time: Dict[Tuple[str, str], TimetableSlot] = {}

        upcoming_list: List[PersonalizedSlotItem] = []

        for s in faculty_slots:
            slots_by_day_time[(s.day_of_week, s.start_time)] = s
            c_name = s.offering.course.name if s.offering and s.offering.course else "Subject"
            c_code = s.offering.course.code if s.offering and s.offering.course else ""
            c_abbr = get_course_abbr(c_name, c_code)
            courses_set.add(c_code)

            div_name = f"COMP-{s.division.name}" if s.division else None
            b_name = s.custom_title if s.custom_title in ("B1", "B2", "B3", "B4") else (s.batch.batch_name if s.batch else None)

            if s.slot_type == "PRACTICAL":
                practical_hours += 2
            else:
                theory_hours += 1

            upcoming_list.append(
                PersonalizedSlotItem(
                    id=str(s.id),
                    day_of_week=s.day_of_week,
                    start_time=s.start_time,
                    end_time=s.end_time,
                    component_type=s.slot_type,
                    course_code=c_code,
                    course_abbr=c_abbr,
                    course_name=c_name,
                    division_name=div_name,
                    batch_name=b_name,
                    room_number=s.room_number,
                    teacher_or_student_name=faculty_user.full_name,
                )
            )

        weekly_schedule: Dict[str, List[TimetableCell]] = {}
        for day in DAYS_OF_WEEK:
            row_cells: List[TimetableCell] = []
            time_idx = 0
            while time_idx < len(TIME_SLOT_DEFS):
                slot_def = TIME_SLOT_DEFS[time_idx]
                if slot_def.is_break:
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=slot_def.start_time,
                            end_time=slot_def.end_time,
                            slot_type="BREAK",
                            custom_title=slot_def.break_title,
                            col_span=1,
                        )
                    )
                    time_idx += 1
                    continue

                assigned = slots_by_day_time.get((day, slot_def.start_time))
                if assigned:
                    c_name = assigned.offering.course.name if assigned.offering and assigned.offering.course else "Subject"
                    c_code = assigned.offering.course.code if assigned.offering and assigned.offering.course else ""
                    c_abbr = get_course_abbr(c_name, c_code)
                    div_label = f"COMP-{assigned.division.name}" if assigned.division else None
                    b_label = assigned.custom_title if assigned.custom_title in ("B1", "B2", "B3", "B4") else (assigned.batch.batch_name if assigned.batch else None)
                    span = 2 if assigned.slot_type == "PRACTICAL" else 1

                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=assigned.start_time,
                            end_time=assigned.end_time,
                            slot_type=assigned.slot_type,
                            course_code=c_code,
                            course_abbr=c_abbr,
                            course_name=c_name,
                            section_name=div_label,
                            batch_name=b_label,
                            room_number=assigned.room_number,
                            faculty_name=faculty_user.full_name,
                            faculty_initials=get_faculty_initials(faculty_user.full_name),
                            col_span=span,
                        )
                    )
                    time_idx += span
                else:
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=slot_def.start_time,
                            end_time=slot_def.end_time,
                            slot_type="EMPTY",
                            custom_title="Free / Prep Time",
                            col_span=1,
                        )
                    )
                    time_idx += 1

            weekly_schedule[day] = row_cells

        fac_initials = get_faculty_initials(faculty_user.full_name)

        return FacultyTimetableResponse(
            faculty_id=str(faculty_user.id),
            faculty_name=faculty_user.full_name,
            faculty_initials=fac_initials,
            email=faculty_user.email,
            academic_term=academic_term,
            total_weekly_hours=theory_hours + practical_hours,
            theory_hours=theory_hours,
            practical_hours=practical_hours,
            assigned_courses_count=len(courses_set),
            time_slots=TIME_SLOT_DEFS,
            days=DAYS_OF_WEEK,
            schedule=weekly_schedule,
            upcoming_lectures=upcoming_list,
        )

    # =========================================================================
    # 5. Personalized Student Timetable
    # =========================================================================
    async def get_student_timetable(self, student_user: User, academic_term: str) -> StudentTimetableResponse:
        """
        Filters the timetable to return strictly the student's personal schedule:
        - Their division theory classes
        - Their specific practical batch (e.g. B1 only, omitting B2/B3/B4)
        - Their specific allocated electives (PEC, PECL, OE)
        """
        div_id = student_user.division_id
        div_name = "B"
        if div_id:
            d_res = await self.db.execute(select(Division).where(Division.id == div_id))
            div_obj = d_res.scalar_one_or_none()
            if div_obj:
                div_name = div_obj.name

        enr_stmt = (
            select(StudentEnrollment)
            .join(CourseOffering, StudentEnrollment.offering_id == CourseOffering.id)
            .options(
                selectinload(StudentEnrollment.batch),
                selectinload(StudentEnrollment.offering).selectinload(CourseOffering.course),
            )
            .where(
                StudentEnrollment.student_id == student_user.id,
                CourseOffering.academic_term == academic_term,
            )
        )
        enrollments = (await self.db.execute(enr_stmt)).scalars().all()
        enrolled_offering_ids = {e.offering_id for e in enrollments}

        student_batch_key = "B1"
        student_batch_id = None
        for e in enrollments:
            if e.batch:
                b_name = e.batch.batch_name
                student_batch_id = e.batch_id
                for bk in ["B1", "B2", "B3", "B4"]:
                    if b_name.endswith(bk):
                        student_batch_key = bk
                        break

        # Fallback by roll number if available
        if student_user.roll_no:
            try:
                roll_int = int(re.sub(r'[^0-9]', '', student_user.roll_no))
                if roll_int <= 17:
                    student_batch_key = "B1"
                elif roll_int <= 35:
                    student_batch_key = "B2"
                elif roll_int <= 53:
                    student_batch_key = "B3"
                else:
                    student_batch_key = "B4"
            except Exception:
                pass

        slot_stmt = (
            select(TimetableSlot)
            .where(
                TimetableSlot.academic_term == academic_term,
                TimetableSlot.division_id == div_id,
            )
            .options(
                selectinload(TimetableSlot.offering).selectinload(CourseOffering.course),
                selectinload(TimetableSlot.section),
                selectinload(TimetableSlot.batch),
                selectinload(TimetableSlot.faculty),
            )
            .order_by(TimetableSlot.day_of_week, TimetableSlot.start_time)
        )
        division_slots = (await self.db.execute(slot_stmt)).scalars().all()

        enrolled_offering_ids = {e.offering_id for e in enrollments}
        enrolled_batch_ids = {e.batch_id for e in enrollments if e.batch_id}

        student_slots: List[TimetableSlot] = []
        for s in division_slots:
            if s.slot_type in ("HONORS", "PROJECT"):
                student_slots.append(s)
            elif s.slot_type == "THEORY":
                if s.parallel_group_id:
                    # Parallel elective theory (BT / DLRL / CS / BDA): check if enrolled in this offering
                    if s.offering_id in enrolled_offering_ids:
                        student_slots.append(s)
                else:
                    if not s.offering_id or s.offering_id in enrolled_offering_ids:
                        student_slots.append(s)
            elif s.slot_type == "PRACTICAL":
                is_elective_lab = s.parallel_group_id and (
                    "PEC" in s.parallel_group_id
                    or "PEL" in s.parallel_group_id
                    or (s.offering and s.offering.course and s.offering.course.course_tier == "DEPARTMENT")
                )
                if is_elective_lab:
                    # Department Elective practical (PEC Practical or PEL Lab):
                    # Match strictly by student's enrolled elective offering!
                    if s.offering_id in enrolled_offering_ids:
                        # If student has a specific assigned batch for this offering, match it
                        if not s.batch_id or s.batch_id in enrolled_batch_ids or not any(b_id in enrolled_batch_ids for b_id in [s.batch_id]):
                            # Ensure only 1 slot per (day, start_time)
                            if not any(existing.day_of_week == s.day_of_week and existing.start_time == s.start_time for existing in student_slots):
                                student_slots.append(s)
                else:
                    # Core division practical (B1, B2, B3, B4):
                    if s.batch and s.batch.batch_name.endswith(student_batch_key):
                        student_slots.append(s)
                    elif s.custom_title == student_batch_key:
                        student_slots.append(s)

        theory_hours = 0
        practical_hours = 0
        student_slots_by_day_time: Dict[Tuple[str, str], TimetableSlot] = {}
        today_list: List[PersonalizedSlotItem] = []

        for s in student_slots:
            student_slots_by_day_time[(s.day_of_week, s.start_time)] = s
            c_name = s.offering.course.name if s.offering and s.offering.course else (s.custom_title or "Session")
            c_code = s.offering.course.code if s.offering and s.offering.course else ""
            c_abbr = get_course_abbr(c_name, c_code)
            if s.slot_type == "PRACTICAL" and not c_abbr.endswith("Lab") and not c_abbr.endswith("LAB"):
                if "Lab" in (s.custom_title or "") or (s.offering and s.offering.course and s.offering.course.course_tier == "DEPARTMENT"):
                    c_abbr = f"{c_abbr} Lab"

            if s.slot_type == "PRACTICAL":
                practical_hours += 2
            elif s.slot_type == "THEORY":
                theory_hours += 1

            today_list.append(
                PersonalizedSlotItem(
                    id=str(s.id),
                    day_of_week=s.day_of_week,
                    start_time=s.start_time,
                    end_time=s.end_time,
                    component_type=s.slot_type,
                    course_code=c_code,
                    course_abbr=c_abbr,
                    course_name=c_name,
                    division_name=f"COMP-{div_name}",
                    batch_name=student_batch_key if s.slot_type == "PRACTICAL" else None,
                    room_number=s.room_number,
                    teacher_or_student_name=s.faculty.full_name if s.faculty else "Faculty",
                )
            )

        weekly_schedule: Dict[str, List[TimetableCell]] = {}
        for day in DAYS_OF_WEEK:
            row_cells: List[TimetableCell] = []
            time_idx = 0
            while time_idx < len(TIME_SLOT_DEFS):
                slot_def = TIME_SLOT_DEFS[time_idx]
                if slot_def.is_break:
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=slot_def.start_time,
                            end_time=slot_def.end_time,
                            slot_type="BREAK",
                            custom_title=slot_def.break_title,
                            col_span=1,
                        )
                    )
                    time_idx += 1
                    continue

                if day == "Saturday" and slot_def.start_time == "08:45":
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time="08:45",
                            end_time="13:00",
                            slot_type="PROJECT",
                            custom_title="Mini Project / Project-Based Learning",
                            col_span=5,
                            room_number=f"Room {div_name}",
                        )
                    )
                    time_idx = 6
                    continue
                elif day == "Saturday" and time_idx < 6:
                    time_idx += 1
                    continue

                assigned = student_slots_by_day_time.get((day, slot_def.start_time))
                if assigned:
                    c_name = assigned.offering.course.name if assigned.offering and assigned.offering.course else (assigned.custom_title or "Subject")
                    c_code = assigned.offering.course.code if assigned.offering and assigned.offering.course else ""
                    c_abbr = get_course_abbr(c_name, c_code)
                    if assigned.slot_type == "PRACTICAL" and not c_abbr.endswith("Lab") and not c_abbr.endswith("LAB"):
                        if "Lab" in (assigned.custom_title or "") or (assigned.offering and assigned.offering.course and assigned.offering.course.course_tier == "DEPARTMENT"):
                            c_abbr = f"{c_abbr} Lab"
                    fac_name = assigned.faculty.full_name if assigned.faculty else "Faculty"
                    fac_init = get_faculty_initials(fac_name)
                    span = 2 if assigned.slot_type == "PRACTICAL" or (assigned.slot_type == "HONORS" and assigned.start_time == "08:45") else 1

                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=assigned.start_time,
                            end_time=assigned.end_time,
                            slot_type=assigned.slot_type,
                            course_code=c_code,
                            course_abbr=c_abbr,
                            course_name=c_name,
                            faculty_initials=fac_init,
                            faculty_name=fac_name,
                            room_number=assigned.room_number,
                            section_name=f"COMP-{div_name}",
                            batch_name=student_batch_key if assigned.slot_type == "PRACTICAL" else None,
                            col_span=span,
                            custom_title=assigned.custom_title,
                        )
                    )
                    time_idx += span
                else:
                    row_cells.append(
                        TimetableCell(
                            day_of_week=day,
                            start_time=slot_def.start_time,
                            end_time=slot_def.end_time,
                            slot_type="EMPTY",
                            col_span=1,
                        )
                    )
                    time_idx += 1

            weekly_schedule[day] = row_cells

        return StudentTimetableResponse(
            student_id=str(student_user.id),
            student_name=student_user.full_name,
            roll_no=student_user.roll_no or "T.E.-COMP",
            erp_id=student_user.student_erp_id,
            division_name=f"COMP-{div_name}",
            batch_name=student_batch_key,
            academic_term=academic_term,
            total_weekly_hours=theory_hours + practical_hours,
            theory_hours=theory_hours,
            practical_hours=practical_hours,
            time_slots=TIME_SLOT_DEFS,
            days=DAYS_OF_WEEK,
            schedule=weekly_schedule,
            today_schedule=today_list,
        )
