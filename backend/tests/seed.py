"""Minimal seed world for API tests.

One department, two Divisions (A and B), two faculty members, an admin, and a few
students per Division. Faculty 1 teaches Operating Systems to Division A only,
faculty 2 teaches Computer Networks to Division B only, each with Timetable Slots.
"""
import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models import (
    AttendanceLog,
    ClassSection,
    Course,
    CourseOffering,
    Department,
    Division,
    FacultyCourseDivision,
    StudentEnrollment,
    TimetableSlot,
    User,
)

TERM = "2026-27-SEM5"
PASSWORD = "test-password"
STUDENTS_PER_DIVISION = 3
INITIAL_TOTAL_CLASSES = 20
INITIAL_ATTENDED_CLASSES = 18


@dataclass
class SeedUser:
    id: uuid.UUID
    email: str
    role: str
    full_name: str


@dataclass
class SeedWorld:
    term: str = TERM
    password: str = PASSWORD
    department_id: uuid.UUID | None = None
    division_ids: dict[str, uuid.UUID] = field(default_factory=dict)       # "A"/"B" -> id
    course_ids: dict[str, uuid.UUID] = field(default_factory=dict)         # "OS"/"CN" -> id
    offering_ids: dict[str, uuid.UUID] = field(default_factory=dict)       # "OS"/"CN" -> id
    faculty: dict[str, SeedUser] = field(default_factory=dict)             # "f1"/"f2"
    students: dict[str, list[SeedUser]] = field(default_factory=dict)      # "A"/"B"
    admin: SeedUser | None = None


def _user(session: Session, *, email, name, role, dept, division=None, roll_no=None) -> User:
    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password(PASSWORD),
        full_name=name,
        role=role,
        department_id=dept.id,
        division_id=division.id if division else None,
        roll_no=roll_no,
        student_erp_id=f"ERP-{roll_no}" if roll_no else None,
    )
    session.add(user)
    return user


def _as_seed_user(user: User) -> SeedUser:
    return SeedUser(id=user.id, email=user.email, role=user.role, full_name=user.full_name)


def seed_world(session: Session) -> SeedWorld:
    world = SeedWorld()

    dept = Department(id=uuid.uuid4(), name="Computer Engineering", code="COMP")
    session.add(dept)
    session.flush()
    world.department_id = dept.id

    divisions = {n: Division(id=uuid.uuid4(), department_id=dept.id, name=n, semester=5) for n in ("A", "B")}
    session.add_all(divisions.values())
    world.division_ids = {n: d.id for n, d in divisions.items()}

    courses = {
        "OS": Course(id=uuid.uuid4(), department_id=dept.id, name="Operating Systems", code="CS501"),
        "CN": Course(id=uuid.uuid4(), department_id=dept.id, name="Computer Networks", code="CS502"),
    }
    session.add_all(courses.values())
    session.flush()
    world.course_ids = {k: c.id for k, c in courses.items()}

    offerings = {k: CourseOffering(id=uuid.uuid4(), course_id=c.id, academic_term=TERM) for k, c in courses.items()}
    session.add_all(offerings.values())
    session.flush()
    world.offering_ids = {k: o.id for k, o in offerings.items()}

    f1 = _user(session, email="f1@test.edu", name="Faculty One", role="FACULTY", dept=dept)
    f2 = _user(session, email="f2@test.edu", name="Faculty Two", role="FACULTY", dept=dept)
    admin = _user(session, email="admin@test.edu", name="Admin User", role="ADMIN", dept=dept)
    session.flush()
    world.faculty = {"f1": _as_seed_user(f1), "f2": _as_seed_user(f2)}
    world.admin = _as_seed_user(admin)

    # (faculty, course key, division name, day, start, end)
    teaching = [
        (f1, "OS", "A", [("Monday", "08:45", "09:45"), ("Wednesday", "09:45", "10:45")]),
        (f2, "CN", "B", [("Tuesday", "08:45", "09:45"), ("Thursday", "09:45", "10:45")]),
    ]
    sections: dict[tuple[str, str], ClassSection] = {}
    for faculty, ckey, dname, slots in teaching:
        section = ClassSection(
            id=uuid.uuid4(),
            offering_id=offerings[ckey].id,
            section_name=f"COMP-{dname}-Theory",
            faculty_id=faculty.id,
        )
        session.add(section)
        sections[(ckey, dname)] = section
        session.add(FacultyCourseDivision(
            id=uuid.uuid4(), faculty_id=faculty.id, course_id=courses[ckey].id, division_id=divisions[dname].id
        ))
        session.flush()
        for day, start, end in slots:
            session.add(TimetableSlot(
                id=uuid.uuid4(),
                academic_term=TERM,
                division_id=divisions[dname].id,
                day_of_week=day,
                start_time=start,
                end_time=end,
                slot_type="THEORY",
                room_number="703",
                offering_id=offerings[ckey].id,
                section_id=section.id,
                faculty_id=faculty.id,
            ))

    # Students: each Division's students take the course taught in that Division.
    course_for_division = {"A": "OS", "B": "CN"}
    for dname, division in divisions.items():
        ckey = course_for_division[dname]
        world.students[dname] = []
        for i in range(1, STUDENTS_PER_DIVISION + 1):
            roll = f"COMP-{dname}-{i:02d}"
            student = _user(
                session, email=f"student.{dname.lower()}{i}@test.edu", name=f"Student {dname}{i}",
                role="STUDENT", dept=dept, division=division, roll_no=roll,
            )
            session.flush()
            session.add(StudentEnrollment(
                id=uuid.uuid4(), student_id=student.id,
                offering_id=offerings[ckey].id, section_id=sections[(ckey, dname)].id,
            ))
            session.add(AttendanceLog(
                id=uuid.uuid4(), student_id=student.id, course_id=courses[ckey].id,
                subject=f"{courses[ckey].name} ({courses[ckey].code})",
                total_classes=INITIAL_TOTAL_CLASSES, attended_classes=INITIAL_ATTENDED_CLASSES,
            ))
            world.students[dname].append(_as_seed_user(student))

    session.commit()
    return world
