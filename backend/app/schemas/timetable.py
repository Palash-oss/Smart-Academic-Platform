from __future__ import annotations

import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Slot & Cell Models
# ---------------------------------------------------------------------------

class TimeSlotDef(BaseModel):
    start_time: str
    end_time: str
    label: str
    is_break: bool = False
    break_title: Optional[str] = None


class ParallelBatchItem(BaseModel):
    course_code: str
    course_abbr: str
    course_name: str
    batch_name: str         # e.g., 'B1' or 'A'
    faculty_initials: str  # e.g., 'SN'
    faculty_name: str      # e.g., 'Prof. Sushma Nagdeote'
    room_number: str       # e.g., 'Lab 701'


class TimetableCell(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    slot_type: str         # 'THEORY', 'PRACTICAL', 'BREAK', 'HONORS', 'PROJECT', 'EMPTY'
    col_span: int = 1
    room_number: Optional[str] = None

    # For single THEORY / PROJECT / HONORS
    custom_title: Optional[str] = None
    course_code: Optional[str] = None
    course_abbr: Optional[str] = None
    course_name: Optional[str] = None
    faculty_initials: Optional[str] = None
    faculty_name: Optional[str] = None
    section_name: Optional[str] = None
    batch_name: Optional[str] = None

    # For parallel multi-batch PRACTICAL slots (e.g., A/B/C/D running concurrently)
    is_parallel: bool = False
    parallel_items: List[ParallelBatchItem] = Field(default_factory=list)


class LegendItem(BaseModel):
    abbr: str
    name: str
    code: Optional[str] = None


# ---------------------------------------------------------------------------
# Master Timetable Response (Official College Format)
# ---------------------------------------------------------------------------

class MasterTimetableHeader(BaseModel):
    class_name: str          # e.g., 'T.E. COMPUTER ENGINEERING-B'
    division_name: str       # e.g., 'COMP-B'
    room_number: str         # e.g., 'Room 703'
    class_teacher: str       # e.g., 'Prof. SACHIN NARKHEDE'
    effective_dates: str     # e.g., '27th January 2026 to 2nd May 2026'
    academic_term: str       # e.g., '2026-27-SEM5'


class MasterTimetableResponse(BaseModel):
    header: MasterTimetableHeader
    time_slots: List[TimeSlotDef]
    days: List[str]
    # Rows keyed by day_of_week, containing ordered cells for that day
    grid: Dict[str, List[TimetableCell]]
    subject_legend: List[LegendItem]
    faculty_legend: List[LegendItem]


# ---------------------------------------------------------------------------
# Personalized Timetable Responses (Faculty & Student)
# ---------------------------------------------------------------------------

class PersonalizedSlotItem(BaseModel):
    id: str
    day_of_week: str
    start_time: str
    end_time: str
    component_type: str     # 'THEORY' or 'PRACTICAL' or 'PROJECT'
    course_code: str
    course_abbr: str
    course_name: str
    division_name: Optional[str] = None
    batch_name: Optional[str] = None
    room_number: str
    teacher_or_student_name: Optional[str] = None


class FacultyTimetableResponse(BaseModel):
    faculty_id: str
    faculty_name: str
    faculty_initials: str
    email: str
    academic_term: str
    total_weekly_hours: int
    theory_hours: int
    practical_hours: int
    assigned_courses_count: int
    time_slots: List[TimeSlotDef]
    days: List[str]
    # Weekly matrix: Day -> list of cells (with assigned slots highlighted, others free)
    schedule: Dict[str, List[TimetableCell]]
    upcoming_lectures: List[PersonalizedSlotItem] = Field(default_factory=list)


class StudentTimetableResponse(BaseModel):
    student_id: str
    student_name: str
    roll_no: str
    erp_id: Optional[str] = None
    division_name: str
    batch_name: str
    academic_term: str
    total_weekly_hours: int
    theory_hours: int
    practical_hours: int
    time_slots: List[TimeSlotDef]
    days: List[str]
    schedule: Dict[str, List[TimetableCell]]
    today_schedule: List[PersonalizedSlotItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Status & Generation Models
# ---------------------------------------------------------------------------

class TimetableStatusResponse(BaseModel):
    academic_term: str
    allotment_completed: bool
    allotment_details: Dict[str, Any]
    timetable_generated: bool
    total_slots_count: int
    can_generate: bool
    message: str


class TimetableGenerateRequest(BaseModel):
    academic_term: str = "2026-27-SEM5"
    room_number: str = "703"
    overwrite: bool = True
