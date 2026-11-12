"""
Pydantic schemas for the Allotment Engine (Revision FRCRCE-3-26).

Covers:
  - Excel upload summary
  - Section / Batch read responses
  - Faculty assignment requests
  - Student enrollment view response
"""
from __future__ import annotations

import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Excel Upload
# ---------------------------------------------------------------------------

class AllotmentRowError(BaseModel):
    """A single row-level error found during Excel validation."""
    row: int
    student_id: str
    course_code: str
    error: str


class AllotmentUploadResponse(BaseModel):
    """Summary returned after a successful allotment upload."""
    status: str = "success"
    total_rows_processed: int
    sections_created: int
    batches_created: int
    faculty_slots_generated: int
    notices: List[str] = []
    errors: List[AllotmentRowError] = []


# ---------------------------------------------------------------------------
# Class Section
# ---------------------------------------------------------------------------

class ClassSectionRead(BaseModel):
    id: uuid.UUID
    section_name: str
    offering_id: uuid.UUID
    faculty_id: Optional[uuid.UUID]
    faculty_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AssignFacultyToSectionRequest(BaseModel):
    faculty_id: uuid.UUID = Field(..., description="UUID of the FACULTY user to assign")


# ---------------------------------------------------------------------------
# Practical Batch
# ---------------------------------------------------------------------------

class PracticalBatchRead(BaseModel):
    id: uuid.UUID
    batch_name: str
    offering_id: uuid.UUID
    section_id: Optional[uuid.UUID]
    faculty_id: Optional[uuid.UUID]
    faculty_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AssignFacultyToBatchRequest(BaseModel):
    faculty_id: uuid.UUID = Field(..., description="UUID of the FACULTY user to assign")


# ---------------------------------------------------------------------------
# Student Enrollment Portal Response
# ---------------------------------------------------------------------------

class TheorySlot(BaseModel):
    section: str
    faculty: str  # "To be assigned" when faculty_id is NULL


class PracticalSlot(BaseModel):
    batch: str
    faculty: str  # "To be assigned" when faculty_id is NULL


class EnrollmentEntry(BaseModel):
    course_code: str
    course_name: str
    tier: str            # CLASS | DEPARTMENT | INSTITUTE
    delivery_mode: str   # INTEGRATED_TH_PR | PRACTICAL_ONLY | THEORY_TUTORIAL | THEORY_ONLY
    theory: Optional[TheorySlot]
    practical: Optional[PracticalSlot]


class MyEnrollmentsResponse(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    roll_no: Optional[str] = None
    academic_term: str
    enrollments: List[EnrollmentEntry]


# ---------------------------------------------------------------------------
# Course Offering
# ---------------------------------------------------------------------------

class CourseOfferingRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    course_code: str
    course_name: str
    academic_term: str
    sections: List[ClassSectionRead] = []
    batches: List[PracticalBatchRead] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Faculty Portal: My Assigned Subjects & Batches
# ---------------------------------------------------------------------------

class FacultyStudentRosterItem(BaseModel):
    id: uuid.UUID
    student_erp_id: Optional[str] = None
    roll_no: Optional[str] = None
    name: str
    email: str
    division: Optional[str] = None
    section_name: Optional[str] = None
    batch_name: Optional[str] = None


class FacultyBatchItem(BaseModel):
    id: uuid.UUID
    batch_name: str
    student_count: int = 0
    section_name: Optional[str] = None
    division: Optional[str] = None
    batch_label: Optional[str] = None
    component_type: str = "PRACTICAL"
    students: List[FacultyStudentRosterItem] = []


class FacultySectionItem(BaseModel):
    id: uuid.UUID
    section_name: str
    student_count: int = 0
    division: Optional[str] = None
    component_type: str = "THEORY"
    students: List[FacultyStudentRosterItem] = []


class FacultyCourseItem(BaseModel):
    offering_id: uuid.UUID
    course_code: str
    course_name: str
    tier: str            # CLASS | DEPARTMENT | INSTITUTE
    delivery_mode: str   # INTEGRATED_TH_PR | PRACTICAL_ONLY | THEORY_TUTORIAL | THEORY_ONLY
    th_hours: int = 3
    pr_hours: int = 2
    tu_hours: int = 0
    sections: List[FacultySectionItem] = []
    batches: List[FacultyBatchItem] = []
    total_students: int = 0
    divisions: List[str] = []
    assigned_types: List[str] = []
    students: List[FacultyStudentRosterItem] = []


class FacultySubjectsResponse(BaseModel):
    faculty_id: str
    faculty_name: str
    department_name: Optional[str] = None
    academic_term: str
    total_courses: int = 0
    total_sections: int = 0
    total_batches: int = 0
    total_students: int = 0
    courses: List[FacultyCourseItem] = []


class CreateFacultyRequest(BaseModel):
    full_name: str
    email: str
    department_code: str = "COMP"
    password: Optional[str] = "faculty123"


class FacultyAllocationUploadResponse(BaseModel):
    status: str = "success"
    academic_term: str
    total_assignments_processed: int
    sections_assigned: int
    batches_assigned: int
    errors: List[str] = []


# ---------------------------------------------------------------------------
# Student Elective Form & Selection Schemas (Revision FRCRCE-3-26)
# ---------------------------------------------------------------------------

class ElectiveSubjectOption(BaseModel):
    code: str
    name: str
    course_tier: str
    delivery_mode: str
    th_hours: int = 3
    pr_hours: int = 2
    tu_hours: int = 0
    credits: int = 3
    description: Optional[str] = None


class ElectiveCategoryGroup(BaseModel):
    category: str         # PEC | PECL | OE
    category_label: str   # "Professional Elective I (Theory)", etc.
    description: str
    min_choices: int = 1
    max_choices: int = 3
    options: List[ElectiveSubjectOption] = []


class TermElectiveConfig(BaseModel):
    academic_term: str
    semester: int
    semester_label: str
    categories: List[ElectiveCategoryGroup] = []


class ElectiveChoiceSubmissionItem(BaseModel):
    category: str
    preference_1: str
    preference_2: Optional[str] = None
    preference_3: Optional[str] = None


class SubmitElectivesRequest(BaseModel):
    academic_term: str
    choices: List[ElectiveChoiceSubmissionItem]


class StudentChoiceItemRead(BaseModel):
    category: str
    category_label: str
    preference_1: str
    preference_1_name: Optional[str] = None
    preference_2: Optional[str] = None
    preference_2_name: Optional[str] = None
    preference_3: Optional[str] = None
    preference_3_name: Optional[str] = None
    allotted_course_code: Optional[str] = None
    allotted_course_name: Optional[str] = None
    section_name: Optional[str] = None
    batch_name: Optional[str] = None
    submitted_at: Optional[str] = None


class StudentTermStatus(BaseModel):
    academic_term: str
    semester: int
    submitted: bool
    allotted: bool
    submitted_at: Optional[str] = None
    choices: List[StudentChoiceItemRead] = []


class StudentElectiveStatusResponse(BaseModel):
    eligible: bool
    student_id: Optional[str] = None
    student_erp_id: Optional[str] = None
    full_name: Optional[str] = None
    roll_no: Optional[str] = None
    department_name: Optional[str] = None
    division_name: Optional[str] = None
    semester: Optional[int] = None
    requires_form_prompt: bool = False
    terms: List[StudentTermStatus] = []


class AdminElectiveProgressResponse(BaseModel):
    academic_term: str
    total_eligible_students: int
    submitted_students_count: int
    pending_students_count: int
    submission_percentage: float
    status: str  # "EMPTY" | "COLLECTING" | "READY_FOR_ALLOTMENT" | "ALLOTTED"
    category_distribution: Dict[str, Dict[str, int]] = {}
    pending_students: List[Dict[str, Any]] = []
    allotted_students_count: int = 0


