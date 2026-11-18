import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    Date,
    DateTime,
    Text,
    JSON,
    Float,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Department & Division
# ---------------------------------------------------------------------------

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    divisions = relationship("Division", back_populates="department", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="department", cascade="all, delete-orphan")
    users = relationship("User", back_populates="department")
    documents = relationship("Document", back_populates="department")


class Division(Base):
    __tablename__ = "divisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, default=60)

    department = relationship("Department", back_populates="divisions")
    students = relationship("User", back_populates="division")
    faculty_assignments = relationship("FacultyCourseDivision", back_populates="division", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Course  (extended for Revision FRCRCE-3-26 allotment engine)
# ---------------------------------------------------------------------------

class Course(Base):
    """
    Curriculum course/subject.

    course_tier   : 'CLASS' | 'DEPARTMENT' | 'INSTITUTE'
    delivery_mode : 'INTEGRATED_TH_PR' | 'PRACTICAL_ONLY' | 'THEORY_TUTORIAL' | 'THEORY_ONLY'
    """
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    # Allotment Engine — Revision FRCRCE-3-26
    course_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="CLASS")
    delivery_mode: Mapped[str] = mapped_column(String(30), nullable=False, default="INTEGRATED_TH_PR")
    th_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    pr_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    tu_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    department = relationship("Department", back_populates="courses")
    attendance_logs = relationship("AttendanceLog", back_populates="course")
    faculty_assignments = relationship(
        "FacultyCourseDivision", back_populates="course", cascade="all, delete-orphan"
    )
    offerings = relationship("CourseOffering", back_populates="course", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "course_tier IN ('CLASS', 'DEPARTMENT', 'INSTITUTE')",
            name="check_course_tier",
        ),
        CheckConstraint(
            "delivery_mode IN ('INTEGRATED_TH_PR', 'PRACTICAL_ONLY', 'THEORY_TUTORIAL', 'THEORY_ONLY')",
            name="check_delivery_mode",
        ),
    )


# ---------------------------------------------------------------------------
# Allotment Engine Tables
# ---------------------------------------------------------------------------

class CourseOffering(Base):
    """
    A course offered in a specific academic term (e.g., '2026-27-SEM5').
    One Course → many CourseOfferings (one per term it is run).
    """
    __tablename__ = "course_offerings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    academic_term: Mapped[str] = mapped_column(String(30), nullable=False)  # e.g. "2026-27-SEM5"

    course = relationship("Course", back_populates="offerings")
    sections = relationship("ClassSection", back_populates="offering", cascade="all, delete-orphan")
    batches = relationship("PracticalBatch", back_populates="offering", cascade="all, delete-orphan")
    enrollments = relationship("StudentEnrollment", back_populates="offering", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("course_id", "academic_term", name="uq_offering_course_term"),
    )


class ClassSection(Base):
    """
    A theory lecture section (e.g., 'CE-A-Theory', 'PEC-BC-Sec1').
    For PRACTICAL_ONLY courses, no section exists (batches link directly to offering).
    """
    __tablename__ = "class_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    section_name: Mapped[str] = mapped_column(String(100), nullable=False)
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    offering = relationship("CourseOffering", back_populates="sections")
    faculty = relationship("User", foreign_keys=[faculty_id])
    batches = relationship("PracticalBatch", back_populates="section", cascade="all, delete-orphan")
    enrollments = relationship("StudentEnrollment", back_populates="section")

    __table_args__ = (
        UniqueConstraint("offering_id", "section_name", name="uq_section_offering_name"),
    )


class PracticalBatch(Base):
    """
    A lab/tutorial batch (e.g., 'CE-A-B1', 'PEC-BC-Sec1-Lab2').
    For PRACTICAL_ONLY: section_id is NULL; batch links directly to offering.
    For INTEGRATED_TH_PR / THEORY_TUTORIAL: section_id points to parent section.
    """
    __tablename__ = "practical_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE"), nullable=True
    )
    batch_name: Mapped[str] = mapped_column(String(120), nullable=False)
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    offering = relationship("CourseOffering", back_populates="batches")
    section = relationship("ClassSection", back_populates="batches")
    faculty = relationship("User", foreign_keys=[faculty_id])
    enrollments = relationship("StudentEnrollment", back_populates="batch")

    __table_args__ = (
        UniqueConstraint("offering_id", "batch_name", name="uq_batch_offering_name"),
    )


class StudentEnrollment(Base):
    """
    Maps a student to an offering, their theory section, and their practical batch.
    section_id and batch_id may be NULL during the allotment run before batches are finalized.
    """
    __tablename__ = "student_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="SET NULL"), nullable=True
    )
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("practical_batches.id", ondelete="SET NULL"), nullable=True
    )

    student = relationship("User", foreign_keys=[student_id], back_populates="enrollments")
    offering = relationship("CourseOffering", back_populates="enrollments")
    section = relationship("ClassSection", back_populates="enrollments")
    batch = relationship("PracticalBatch", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("student_id", "offering_id", name="uq_enrollment_student_offering"),
    )


# ---------------------------------------------------------------------------
# Student Elective Form Choices (Revision FRCRCE-3-26)
# ---------------------------------------------------------------------------

class StudentElectiveChoice(Base):
    """
    Stores elective preferences submitted by students via the onboarding/login form.
    Categories:
      - 'PEC'  (Professional Elective Course - Theory)
      - 'PECL' (Professional Elective Course - Lab)
      - 'OE'   (Open Elective - Institute level)
    """
    __tablename__ = "student_elective_choices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    academic_term: Mapped[str] = mapped_column(String(30), nullable=False)  # e.g. "2026-27-SEM5", "2026-27-SEM6"
    category: Mapped[str] = mapped_column(String(20), nullable=False)       # PEC | PECL | OE

    preference_1: Mapped[str] = mapped_column(String(50), nullable=False)   # Course code
    preference_2: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    preference_3: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    allotted_course_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student = relationship("User", foreign_keys=[student_id], back_populates="elective_choices")

    __table_args__ = (
        UniqueConstraint("student_id", "academic_term", "category", name="uq_student_term_category"),
    )


# ---------------------------------------------------------------------------
# Users & Access Control
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)

    # Student identifier fields (for allotment upload matching)
    student_erp_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True, index=True)
    roll_no: Mapped[Optional[str]] = mapped_column(String(30), unique=True, nullable=True)

    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    division_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    department = relationship("Department", back_populates="users")
    division = relationship("Division", back_populates="students")
    attendance_logs = relationship("AttendanceLog", back_populates="student", cascade="all, delete-orphan")
    faculty_assignments = relationship(
        "FacultyCourseDivision", back_populates="faculty", cascade="all, delete-orphan"
    )
    enrollments = relationship("StudentEnrollment", back_populates="student",
                               foreign_keys="[StudentEnrollment.student_id]",
                               cascade="all, delete-orphan")
    elective_choices = relationship("StudentElectiveChoice", back_populates="student", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("role IN ('STUDENT', 'FACULTY', 'ADMIN')", name="check_user_role"),
    )


class FacultyCourseDivision(Base):
    __tablename__ = "faculty_course_division"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False
    )

    faculty = relationship("User", back_populates="faculty_assignments")
    course = relationship("Course", back_populates="faculty_assignments")
    division = relationship("Division", back_populates="faculty_assignments")


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String, nullable=False)
    total_classes: Mapped[int] = mapped_column(Integer, nullable=False)
    attended_classes: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    student = relationship("User", back_populates="attendance_logs")
    course = relationship("Course", back_populates="attendance_logs")


class LectureSession(Base):
    __tablename__ = "lecture_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=True
    )
    division_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=True
    )
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String, nullable=False)
    session_date: Mapped[str] = mapped_column(String(20), nullable=False)  # 'YYYY-MM-DD'
    session_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    present_student_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False)
    all_enrolled_student_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Timetable Slot (Post-Allotment Engine Master & Personalized Schedules)
# ---------------------------------------------------------------------------

class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    academic_term: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., '2026-27-SEM5'
    division_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=True
    )
    day_of_week: Mapped[str] = mapped_column(String(20), nullable=False)    # Monday, Tuesday, Wednesday...
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)     # e.g., '08:45'
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)       # e.g., '09:45'
    slot_type: Mapped[str] = mapped_column(String(30), nullable=False, default="THEORY")  # THEORY, PRACTICAL, BREAK, HONORS, PROJECT
    room_number: Mapped[str] = mapped_column(String(50), nullable=False, default="703")
    custom_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Links to finalized allotment entities
    offering_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=True
    )
    section_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE"), nullable=True
    )
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("practical_batches.id", ondelete="CASCADE"), nullable=True
    )
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Identifier for concurrent parallel practical lab batches (e.g. B1/B2/B3/B4 grouped together)
    parallel_group_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    division = relationship("Division")
    offering = relationship("CourseOffering")
    section = relationship("ClassSection")
    batch = relationship("PracticalBatch")
    faculty = relationship("User", foreign_keys=[faculty_id])


# ---------------------------------------------------------------------------
# Extra Lecture (one-off lecture on a calendar date, outside the weekly timetable)
# ---------------------------------------------------------------------------

class ExtraLecture(Base):
    __tablename__ = "extra_lectures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    academic_term: Mapped[str] = mapped_column(String(50), nullable=False)
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    lecture_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)    # e.g. '13:30'
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)      # e.g. '15:30'
    room_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="SCHEDULED")  # SCHEDULED | CANCELLED
    attendance_marked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    faculty = relationship("User", foreign_keys=[faculty_id])
    division = relationship("Division")
    offering = relationship("CourseOffering")


# ---------------------------------------------------------------------------
# Document RAG
# ---------------------------------------------------------------------------

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    doc_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    source_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    department = relationship("Department", back_populates="documents")
    embeddings = relationship("DocumentEmbedding", back_populates="document", cascade="all, delete-orphan")


class DocumentEmbedding(Base):
    __tablename__ = "document_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[Vector] = mapped_column(Vector(768), nullable=False)

    document = relationship("Document", back_populates="embeddings")


# ---------------------------------------------------------------------------
# Peer-to-Peer Faculty Class Substitution & Mutual Slot Exchange Protocol
# ---------------------------------------------------------------------------

class ClassSwapRequest(Base):
    __tablename__ = "class_swap_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    academic_term: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., '2026-27-SEM5'
    source_slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetable_slots.id", ondelete="CASCADE"), nullable=False
    )
    requesting_faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    target_faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    target_slot_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True
    )
    swap_date: Mapped[str] = mapped_column(String(20), nullable=False)      # 'YYYY-MM-DD'
    swap_type: Mapped[str] = mapped_column(String(30), default="SUBSTITUTION")  # 'SUBSTITUTION' or 'EXCHANGE'
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")      # 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    source_slot = relationship("TimetableSlot", foreign_keys=[source_slot_id])
    target_slot = relationship("TimetableSlot", foreign_keys=[target_slot_id])
    requesting_faculty = relationship("User", foreign_keys=[requesting_faculty_id])
    target_faculty = relationship("User", foreign_keys=[target_faculty_id])


# ---------------------------------------------------------------------------
# Attendance Condonation & Official Duty Leave (Autonomous Scheme Rule 4.2)
# ---------------------------------------------------------------------------

class AttendanceCondonation(Base):
    __tablename__ = "attendance_condonations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String, nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)     # 'MEDICAL', 'DUTY_SPORTS', 'DUTY_NSS_CULTURAL', 'SPECIAL_DELEGATION'
    missed_sessions_count: Mapped[int] = mapped_column(Integer, default=1)
    granted_classes: Mapped[int] = mapped_column(Integer, default=1)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="APPROVED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student = relationship("User", foreign_keys=[student_id])
    approver = relationship("User", foreign_keys=[approved_by])


# ---------------------------------------------------------------------------
# Exam Cell & Continuous Assessment (Autonomous Scheme FRCRCE-3-26)
# ---------------------------------------------------------------------------

class CourseOutcome(Base):
    """
    Syllabus Course Outcome (CO1 to CO6) defined in curriculum.
    """
    __tablename__ = "course_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    co_code: Mapped[str] = mapped_column(String(20), nullable=False)   # e.g., 'CO1', 'CO2'
    description: Mapped[str] = mapped_column(Text, nullable=False)
    bloom_level: Mapped[str] = mapped_column(String(50), default="Apply")  # 'Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'

    course = relationship("Course", backref="outcomes")

    __table_args__ = (
        UniqueConstraint("course_id", "co_code", name="uq_course_outcome_code"),
    )


class CourseCOPOMapping(Base):
    """
    CO to PO / PSO Articulation Matrix entry (weights: 3-High, 2-Medium, 1-Low).
    """
    __tablename__ = "course_co_po_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    co_code: Mapped[str] = mapped_column(String(20), nullable=False)
    po_code: Mapped[str] = mapped_column(String(20), nullable=False)   # 'PO1'..'PO12', 'PSO1', 'PSO2'
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=2)  # 1, 2, or 3

    course = relationship("Course", backref="co_po_mappings")

    __table_args__ = (
        UniqueConstraint("course_id", "co_code", "po_code", name="uq_course_co_po"),
    )


class ExamEvaluationTemplate(Base):
    """
    Assessment blueprint for a course offering created by the teaching faculty.
    """
    __tablename__ = "exam_evaluation_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    academic_term: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(150), default="Standard Course Evaluation Scheme")
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # 'DRAFT', 'ACTIVE', 'LOCKED'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    offering = relationship("CourseOffering")
    faculty = relationship("User")
    components = relationship("ExamComponent", back_populates="template", cascade="all, delete-orphan", order_by="ExamComponent.order_index")


class ExamComponent(Base):
    """
    Top-level evaluation component: THEORY_ISE (20), THEORY_MSE (30), THEORY_ESE (50), LAB_ISE (50/100), TUT_ISE (50).
    """
    __tablename__ = "exam_components"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_evaluation_templates.id", ondelete="CASCADE"), nullable=False
    )
    component_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'THEORY_ISE', 'THEORY_MSE', 'THEORY_ESE', 'LAB_ISE', 'TUT_ISE'
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    max_marks: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    passing_marks: Mapped[float] = mapped_column(Float, nullable=False, default=8.0)
    weight_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    formula_type: Mapped[str] = mapped_column(String(30), default="SUM")    # 'SUM', 'SCALED', 'BEST_OF_N'
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    template = relationship("ExamEvaluationTemplate", back_populates="components")
    sub_components = relationship("ExamSubComponent", back_populates="component", cascade="all, delete-orphan", order_by="ExamSubComponent.order_index")


class ExamSubComponent(Base):
    """
    Individual question or sub-activity within an evaluation component (e.g. 'Class Test 1', 'Activity / Presentation', 'Q1a').
    """
    __tablename__ = "exam_sub_components"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_components.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    sub_type: Mapped[str] = mapped_column(String(50), default="TEST")       # 'TEST', 'ACTIVITY', 'ASSIGNMENT', 'QUIZ', 'PRESENTATION', 'EXPERIMENT', 'TUTORIAL'
    max_marks: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    mapped_cos: Mapped[Optional[list]] = mapped_column(JSON, default=list)  # list of CO codes, e.g. ["CO1", "CO2"]
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    component = relationship("ExamComponent", back_populates="sub_components")
    student_marks = relationship("StudentMarksRecord", back_populates="sub_component", cascade="all, delete-orphan")


class StudentMarksRecord(Base):
    """
    Student score on an individual question / sub-component.
    """
    __tablename__ = "student_marks_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    sub_component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_sub_components.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    marks_obtained: Mapped[float] = mapped_column(Float, default=0.0)
    is_absent: Mapped[bool] = mapped_column(Boolean, default=False)
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    entered_by_faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    offering = relationship("CourseOffering")
    sub_component = relationship("ExamSubComponent", back_populates="student_marks")
    student = relationship("User", foreign_keys=[student_id])
    entered_by = relationship("User", foreign_keys=[entered_by_faculty_id])

    __table_args__ = (
        UniqueConstraint("sub_component_id", "student_id", name="uq_student_sub_component_marks"),
    )


class ExamLockPeriod(Base):
    """
    Lock & Deadline governance per offering component.
    """
    __tablename__ = "exam_lock_periods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    component_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'THEORY_ISE', 'THEORY_MSE', 'THEORY_ESE', 'LAB_ISE', 'TUT_ISE', 'ALL'
    submission_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    offering = relationship("CourseOffering")
    locked_by = relationship("User", foreign_keys=[locked_by_user_id])

    __table_args__ = (
        UniqueConstraint("offering_id", "component_type", name="uq_offering_component_lock"),
    )


class ExamUnlockRequest(Base):
    """
    Formal faculty request to unlock marks after a deadline for corrections with audit trail.
    """
    __tablename__ = "exam_unlock_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_offerings.id", ondelete="CASCADE"), nullable=False
    )
    component_type: Mapped[str] = mapped_column(String(50), nullable=False)
    requested_by_faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")   # 'PENDING', 'APPROVED', 'REJECTED'
    approved_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    unlock_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    offering = relationship("CourseOffering")
    requested_by = relationship("User", foreign_keys=[requested_by_faculty_id])
    approved_by = relationship("User", foreign_keys=[approved_by_admin_id])


class MarksAuditLog(Base):
    """
    Immutable audit log for every change made to student marks.
    """
    __tablename__ = "marks_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_marks_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_marks_records.id", ondelete="CASCADE"), nullable=False
    )
    old_marks: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    new_marks: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    old_is_absent: Mapped[bool] = mapped_column(Boolean, default=False)
    new_is_absent: Mapped[bool] = mapped_column(Boolean, default=False)
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    changed_by = relationship("User", foreign_keys=[changed_by_user_id])
