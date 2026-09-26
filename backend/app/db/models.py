import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    DateTime,
    Text,
    JSON,
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
