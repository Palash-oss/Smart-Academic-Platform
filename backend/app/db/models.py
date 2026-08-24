import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Text as VectorColumnType

from app.db.session import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)  # 'COMP', 'AIDS', 'ECS', 'MECH'

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
    name: Mapped[str] = mapped_column(String, nullable=False)  # 'A', 'B'
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    student_count: Mapped[int] = mapped_column(Integer, nullable=False)

    department = relationship("Department", back_populates="divisions")
    users = relationship("User", back_populates="division")
    faculty_assignments = relationship("FacultyCourseDivision", back_populates="division")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)  # e.g., '25PCC13CE11'
    semester: Mapped[int] = mapped_column(Integer, nullable=False)

    department = relationship("Department", back_populates="courses")
    faculty_assignments = relationship("FacultyCourseDivision", back_populates="course")
    attendance_logs = relationship("AttendanceLog", back_populates="course")
    documents = relationship("Document", back_populates="course")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # 'STUDENT' or 'FACULTY'

    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    division_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    department = relationship("Department", back_populates="users")
    division = relationship("Division", back_populates="users")
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
    title: Mapped[str] = mapped_column(String, nullable=False)
    doc_type: Mapped[str] = mapped_column(String, nullable=True)
    source_path: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    department = relationship("Department", back_populates="documents")
    course = relationship("Course", back_populates="documents")
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
    embedding = mapped_column(VectorColumnType, nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=True)

    document = relationship("Document", back_populates="embeddings")
