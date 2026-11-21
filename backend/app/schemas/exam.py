"""
Schemas for Exam Cell, Continuous Assessment, Gradebook, and OBE Attainment.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CourseOutcomeOut(BaseModel):
    id: str
    co_code: str
    description: str
    bloom_level: str


class COPOMappingOut(BaseModel):
    co_code: str
    po_code: str
    weight: int


class ExamSubComponentIn(BaseModel):
    id: Optional[str] = None
    title: str = Field(min_length=1, max_length=150)
    sub_type: str = "TEST"  # 'TEST', 'ACTIVITY', 'ASSIGNMENT', 'QUIZ', 'PRESENTATION', 'EXPERIMENT', 'TUTORIAL'
    max_marks: float = Field(gt=0, le=100)
    mapped_cos: List[str] = Field(default_factory=list)
    order_index: int = 0


class ExamSubComponentOut(BaseModel):
    id: str
    component_id: str
    title: str
    sub_type: str
    max_marks: float
    mapped_cos: List[str]
    order_index: int


class ExamComponentIn(BaseModel):
    id: Optional[str] = None
    component_type: str  # 'THEORY_ISE', 'THEORY_MSE', 'THEORY_ESE', 'LAB_ISE', 'TUT_ISE'
    display_name: str
    max_marks: float = Field(gt=0)
    passing_marks: float = Field(ge=0)
    weight_percentage: float = 20.0
    formula_type: str = "SUM"  # 'SUM', 'SCALED', 'BEST_OF_N'
    order_index: int = 0
    sub_components: List[ExamSubComponentIn] = Field(default_factory=list)


class ExamComponentOut(BaseModel):
    id: str
    template_id: str
    component_type: str
    display_name: str
    max_marks: float
    passing_marks: float
    weight_percentage: float
    formula_type: str
    order_index: int
    sub_components: List[ExamSubComponentOut] = Field(default_factory=list)


class ExamTemplateIn(BaseModel):
    title: str = "Standard Course Evaluation Scheme"
    components: List[ExamComponentIn]


class ExamTemplateOut(BaseModel):
    id: str
    offering_id: str
    course_code: str
    course_name: str
    academic_term: str
    title: str
    status: str
    available_cos: List[CourseOutcomeOut]
    components: List[ExamComponentOut]


# --- Gradebook & Marks Entry ---

class StudentMarksItem(BaseModel):
    sub_component_id: str
    marks_obtained: float = Field(ge=0)
    is_absent: bool = False
    remarks: Optional[str] = None


class GradebookStudentRow(BaseModel):
    student_id: str
    roll_no: str
    erp_id: Optional[str] = None
    full_name: str
    division_name: str
    batch_name: Optional[str] = None
    scores: Dict[str, float] = Field(default_factory=dict)  # sub_component_id -> marks
    absents: Dict[str, bool] = Field(default_factory=dict)  # sub_component_id -> is_absent
    component_totals: Dict[str, float] = Field(default_factory=dict)  # component_type -> total


class GradebookResponse(BaseModel):
    offering_id: str
    course_code: str
    course_name: str
    academic_term: str
    is_locked: bool
    deadline: Optional[datetime] = None
    lock_status_label: str
    can_edit: bool
    columns: List[ExamComponentOut]
    students: List[GradebookStudentRow]


class BatchMarksSavePayload(BaseModel):
    component_type: str
    updates: List[Dict[str, float | str | bool]]  # [{ "student_id": "...", "sub_component_id": "...", "marks": 9.5, "is_absent": false }]
    change_reason: Optional[str] = "Normal evaluation entry"


# --- Locking & Moderation ---

class LockActionPayload(BaseModel):
    component_type: str = "ALL"  # 'THEORY_ISE', 'THEORY_MSE', etc. or 'ALL'
    action: str = "LOCK"        # 'LOCK' or 'UNLOCK'


class UnlockRequestPayload(BaseModel):
    component_type: str
    reason: str = Field(min_length=10, max_length=500)


class UnlockRequestOut(BaseModel):
    id: str
    offering_id: str
    component_type: str
    requested_by_name: str
    reason: str
    status: str
    unlock_expires_at: Optional[datetime]
    created_at: datetime


# --- Outcome-Based Education (OBE) Attainment ---

class COAttainmentItem(BaseModel):
    co_code: str
    description: str
    bloom_level: str
    total_evaluated_students: int
    target_marks_threshold_pct: float = 60.0  # standard 60%
    students_meeting_target: int
    percentage_attainment: float
    attainment_level: int  # 3 (>=70%), 2 (60-69%), 1 (50-59%), 0 (<50%)


class POAttainmentItem(BaseModel):
    po_code: str
    target_score: float = 3.0
    computed_attainment: float
    attainment_level: float


class OBEAttainmentResponse(BaseModel):
    offering_id: str
    course_code: str
    course_name: str
    co_attainments: List[COAttainmentItem]
    po_attainments: List[POAttainmentItem]
    pso_attainments: List[POAttainmentItem]
    summary_text: str


# --- Student View ---

class StudentCourseGradeSummary(BaseModel):
    offering_id: str
    course_code: str
    course_name: str
    academic_term: str
    components: List[Dict[str, str | float | bool]]
    total_marks_obtained: float
    total_max_marks: float
    overall_percentage: float
