import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    ForeignKey,
    DateTime,
    Text,
    JSON,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    divisions = relationship("Division", back_populates="department", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="department", cascade="all, delete-orphan")
    users = relationship("User", back_populates="department")
    documents = relationship("Document", back_populates="department")


class Division(Base):
    __tablename__ = "divisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, default=60)

    department = relationship("Department", back_populates="divisions")
    students = relationship("User", back_populates="division")
    faculty_assignments = relationship("FacultyCourseDivision", back_populates="division", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    department = relationship("Department", back_populates="courses")
    attendance_logs = relationship("AttendanceLog", back_populates="course")
    faculty_assignments = relationship("FacultyCourseDivision", back_populates="course", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    division_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="SET NULL"), nullable=True
    )

    department = relationship("Department", back_populates="users")
    division = relationship("Division", back_populates="students")
    attendance_logs = relationship("AttendanceLog", back_populates="student", cascade="all, delete-orphan")
    faculty_assignments = relationship("FacultyCourseDivision", back_populates="faculty", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("role IN ('STUDENT', 'FACULTY')", name="check_user_role"),
    )


class FacultyCourseDivision(Base):
    __tablename__ = "faculty_course_division"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
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


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
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

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=True
    )
    division_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String, nullable=False)
    session_date: Mapped[str] = mapped_column(String(20), nullable=False) # 'YYYY-MM-DD'
    session_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    present_student_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False)
    all_enrolled_student_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    doc_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    department = relationship("Department", back_populates="documents")
    embeddings = relationship("DocumentEmbedding", back_populates="document", cascade="all, delete-orphan")


class DocumentEmbedding(Base):
    __tablename__ = "document_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[Vector] = mapped_column(Vector(768), nullable=False)

    document = relationship("Document", back_populates="embeddings")
