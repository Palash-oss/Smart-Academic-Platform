"""Extra Lecture module: the rules for one-off lectures on a calendar date.

The API routes are thin wrappers around ``ExtraLectureService``. ``place_extra_lectures`` is the shared helper
that puts Extra Lectures into any weekly grid (faculty, student, Master Timetable).
"""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import today
from app.db.models import CourseOffering, ExtraLecture, TimetableSlot, User
from app.schemas.extra_lecture import (
    ExtraLectureCreate,
    ExtraLectureDivisionOption,
    ExtraLectureFormOptions,
    ExtraLectureNotice,
    ExtraLectureOut,
    ExtraLectureSubjectOption,
)
from app.schemas.timetable import TimetableCell

HOUR_BOUNDARIES = ["13:30", "14:30", "15:30", "16:30", "17:30"]
SATURDAY = 5
DEFAULT_ROOM = "703"
UPCOMING_SATURDAYS = 12


class ExtraLectureError(Exception):
    """A rule failed. ``detail`` is shown to the user; ``status_code`` is the HTTP status."""

    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def week_start(on: Optional[date] = None) -> date:
    """Monday of the week containing ``on`` (default: today)."""
    on = on or today()
    return on - timedelta(days=on.weekday())


def _load_options():
    return (
        selectinload(ExtraLecture.faculty),
        selectinload(ExtraLecture.division),
        selectinload(ExtraLecture.offering).selectinload(CourseOffering.course),
    )


def to_out(el: ExtraLecture) -> ExtraLectureOut:
    course = el.offering.course
    return ExtraLectureOut(
        id=str(el.id),
        subject_name=course.name,
        subject_code=course.code,
        faculty_name=el.faculty.full_name,
        division_name=f"COMP-{el.division.name}",
        date=el.lecture_date,
        start_time=el.start_time,
        end_time=el.end_time,
        room_number=el.room_number,
        status=el.status,
        attendance_marked=el.attendance_marked,
        hours=HOUR_BOUNDARIES.index(el.end_time) - HOUR_BOUNDARIES.index(el.start_time),
    )


def place_extra_lectures(
    schedule: Dict[str, List[TimetableCell]],
    extra_lectures: List[ExtraLectureOut],
    current_week_start: Optional[date] = None,
) -> Dict[str, List[TimetableCell]]:
    """Place Extra Lectures that fall in the current week into the Saturday-afternoon cells of ``schedule``.

    Each Extra Lecture replaces the cells covering its hours with one cell spanning them. Lectures outside the
    current week are left out (they belong in the Upcoming list). Mutates and returns ``schedule``.
    """
    start = current_week_start or week_start()
    end = start + timedelta(days=6)
    row = schedule.get("Saturday")
    if row is None:
        return schedule
    for el in extra_lectures:
        if not (start <= el.date <= end) or el.date.weekday() != SATURDAY:
            continue
        first = next((i for i, c in enumerate(row) if c.start_time == el.start_time), None)
        if first is None:
            continue
        last = next((i for i, c in enumerate(row) if c.end_time == el.end_time), None)
        if last is None or last < first:
            continue
        row[first : last + 1] = [
            TimetableCell(
                day_of_week="Saturday",
                start_time=el.start_time,
                end_time=el.end_time,
                slot_type="EXTRA",
                col_span=el.hours,
                room_number=el.room_number,
                course_code=el.subject_code,
                course_name=el.subject_name,
                faculty_name=el.faculty_name,
                section_name=el.division_name,
                is_extra=True,
                extra_lecture_id=el.id,
                extra_date=el.date.isoformat(),
                extra_status=el.status,
            )
        ]
    return schedule


class ExtraLectureService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------ options
    async def _taught_slots(self, faculty: User, term: str) -> List[TimetableSlot]:
        stmt = (
            select(TimetableSlot)
            .where(
                TimetableSlot.academic_term == term,
                TimetableSlot.faculty_id == faculty.id,
                TimetableSlot.division_id.is_not(None),
            )
            .options(
                selectinload(TimetableSlot.division),
                selectinload(TimetableSlot.offering).selectinload(CourseOffering.course),
            )
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def _default_room(self, division_id: uuid.UUID, term: str) -> str:
        stmt = select(TimetableSlot.room_number).where(
            TimetableSlot.academic_term == term,
            TimetableSlot.division_id == division_id,
            TimetableSlot.room_number.is_not(None),
        )
        rooms = Counter((await self.db.execute(stmt)).scalars().all())
        return rooms.most_common(1)[0][0] if rooms else DEFAULT_ROOM

    async def form_options(self, faculty: User, term: str) -> ExtraLectureFormOptions:
        slots = await self._taught_slots(faculty, term)
        divisions: Dict[uuid.UUID, ExtraLectureDivisionOption] = {}
        for s in sorted(slots, key=lambda s: s.division.name):
            opt = divisions.get(s.division_id)
            if opt is None:
                opt = divisions[s.division_id] = ExtraLectureDivisionOption(
                    division_id=str(s.division_id),
                    division_name=f"COMP-{s.division.name}",
                    default_room=await self._default_room(s.division_id, term),
                    subjects=[],
                )
            if s.offering and s.offering.course and all(x.offering_id != str(s.offering_id) for x in opt.subjects):
                opt.subjects.append(
                    ExtraLectureSubjectOption(
                        offering_id=str(s.offering_id),
                        subject_name=s.offering.course.name,
                        subject_code=s.offering.course.code,
                    )
                )
        first = today() + timedelta(days=(SATURDAY - today().weekday()) % 7 or 7)
        return ExtraLectureFormOptions(
            divisions=list(divisions.values()),
            hour_boundaries=HOUR_BOUNDARIES,
            upcoming_saturdays=[first + timedelta(weeks=i) for i in range(UPCOMING_SATURDAYS)],
        )

    # ------------------------------------------------------------------- create
    async def create(self, faculty: User, data: ExtraLectureCreate) -> ExtraLectureOut:
        if faculty.role not in ("FACULTY", "ADMIN"):
            raise ExtraLectureError("Only faculty can add an Extra Lecture.", 403)

        slots = await self._taught_slots(faculty, data.academic_term)
        in_division = [s for s in slots if s.division_id == data.division_id]
        if not in_division:
            raise ExtraLectureError("You can only add an Extra Lecture for a Division you teach.")
        if not any(s.offering_id == data.offering_id for s in in_division):
            raise ExtraLectureError("You don't teach that subject to this Division.")

        if data.lecture_date.weekday() != SATURDAY:
            raise ExtraLectureError("An Extra Lecture must be on a Saturday.")
        if data.lecture_date <= today():
            raise ExtraLectureError("The date must be after today.")

        starts, ends = HOUR_BOUNDARIES[:-1], HOUR_BOUNDARIES[1:]
        if data.start_time not in starts:
            raise ExtraLectureError(f"The start time must be one of {', '.join(starts)}.")
        if data.end_time not in ends or HOUR_BOUNDARIES.index(data.end_time) <= HOUR_BOUNDARIES.index(data.start_time):
            raise ExtraLectureError("The end time must be a later hour boundary, no later than 17:30.")

        await self._reject_clashes(faculty, data)

        el = ExtraLecture(
            academic_term=data.academic_term,
            faculty_id=faculty.id,
            division_id=data.division_id,
            offering_id=data.offering_id,
            lecture_date=data.lecture_date,
            start_time=data.start_time,
            end_time=data.end_time,
            room_number=data.room_number.strip(),
            status="SCHEDULED",
            attendance_marked=False,
        )
        self.db.add(el)
        await self.db.commit()
        return to_out(await self._get(el.id))

    async def _reject_clashes(self, faculty: User, data: ExtraLectureCreate) -> None:
        """Block creation when a SCHEDULED Extra Lecture on that date overlaps the requested hours.

        Touching ranges (one ends when the other starts) don't overlap. CANCELLED lectures are ignored.
        The teacher clash is reported before the Division clash.
        """
        stmt = (
            select(ExtraLecture)
            .where(
                ExtraLecture.academic_term == data.academic_term,
                ExtraLecture.lecture_date == data.lecture_date,
                ExtraLecture.status == "SCHEDULED",
                ExtraLecture.start_time < data.end_time,
                ExtraLecture.end_time > data.start_time,
                or_(ExtraLecture.faculty_id == faculty.id, ExtraLecture.division_id == data.division_id),
            )
            .options(*_load_options())
            .order_by(ExtraLecture.start_time)
        )
        clashes = list((await self.db.execute(stmt)).scalars().all())
        mine = next((c for c in clashes if c.faculty_id == faculty.id), None)
        if mine:
            raise ExtraLectureError(
                f"You already have an Extra Lecture for {mine.offering.course.name} "
                f"({mine.start_time}–{mine.end_time}) for COMP-{mine.division.name} on that date.",
                409,
            )
        if clashes:
            other = clashes[0]
            raise ExtraLectureError(
                f"COMP-{other.division.name} already has an Extra Lecture for {other.offering.course.name} "
                f"({other.start_time}–{other.end_time}) with {other.faculty.full_name} on that date.",
                409,
            )

    # ------------------------------------------------------------------- cancel
    async def cancel(self, user: User, extra_lecture_id: uuid.UUID) -> ExtraLectureOut:
        if user.role not in ("FACULTY", "ADMIN"):
            raise ExtraLectureError("Only faculty can cancel an Extra Lecture.", 403)
        stmt = select(ExtraLecture).where(ExtraLecture.id == extra_lecture_id).with_for_update()
        el = (await self.db.execute(stmt)).scalar_one_or_none()
        if el is None:
            raise ExtraLectureError("Extra Lecture not found.", 404)
        if user.role != "ADMIN" and el.faculty_id != user.id:
            raise ExtraLectureError("Only the faculty member who created this Extra Lecture can cancel it.", 403)
        if el.status == "CANCELLED":
            raise ExtraLectureError("This Extra Lecture is already cancelled.", 409)
        if el.lecture_date < today():
            raise ExtraLectureError("This Extra Lecture's date has passed, so it can no longer be cancelled.", 409)
        el.status = "CANCELLED"
        el.cancelled_at = datetime.now(timezone.utc)
        await self.db.commit()
        return to_out(await self._get(el.id))

    # --------------------------------------------------------------- attendance
    async def mark_attendance(
        self,
        user: User,
        extra_lecture_id: uuid.UUID,
        present_student_ids: List[uuid.UUID],
        all_enrolled_student_ids: List[uuid.UUID],
    ) -> dict:
        """Record attendance for an Extra Lecture: one class per hour, exempt from the daily session cap."""
        from app.services.attendance_service import mark_session_attendance

        if user.role not in ("FACULTY", "ADMIN"):
            raise ExtraLectureError("Only faculty can take attendance for an Extra Lecture.", 403)
        stmt = select(ExtraLecture).where(ExtraLecture.id == extra_lecture_id).with_for_update()
        el = (await self.db.execute(stmt)).scalar_one_or_none()
        if el is None:
            raise ExtraLectureError("Extra Lecture not found.", 404)
        if user.role != "ADMIN" and el.faculty_id != user.id:
            raise ExtraLectureError("Only the faculty member who created this Extra Lecture can take its attendance.", 403)
        if el.status == "CANCELLED":
            raise ExtraLectureError("This Extra Lecture is cancelled, so attendance cannot be taken.", 409)
        if el.attendance_marked:
            raise ExtraLectureError("Attendance has already been taken for this Extra Lecture.", 409)
        if el.lecture_date != today():
            raise ExtraLectureError("Attendance can only be taken on the day of the Extra Lecture.", 409)

        out = to_out(await self._get(el.id))
        result = await mark_session_attendance(
            db=self.db,
            faculty_id=el.faculty_id,
            subject=out.subject_name,
            session_date=el.lecture_date.isoformat(),
            present_student_ids=present_student_ids,
            all_enrolled_student_ids=all_enrolled_student_ids,
            hours=out.hours,
            enforce_daily_cap=False,
            commit=False,
        )
        el.attendance_marked = True
        await self.db.commit()
        return result

    async def _get(self, extra_lecture_id: uuid.UUID) -> ExtraLecture:
        stmt = select(ExtraLecture).where(ExtraLecture.id == extra_lecture_id).options(*_load_options())
        return (await self.db.execute(stmt)).scalar_one()

    # ------------------------------------------------------------------ queries
    async def list_for_division(self, division_id: uuid.UUID, term: str, from_date: date) -> List[ExtraLectureOut]:
        stmt = (
            select(ExtraLecture)
            .where(
                ExtraLecture.academic_term == term,
                ExtraLecture.division_id == division_id,
                ExtraLecture.lecture_date >= from_date,
            )
            .options(*_load_options())
            .order_by(ExtraLecture.lecture_date, ExtraLecture.start_time)
        )
        return [to_out(el) for el in (await self.db.execute(stmt)).scalars().all()]

    async def list_for_faculty(self, faculty_id: uuid.UUID, term: str, from_date: date) -> List[ExtraLectureOut]:
        stmt = (
            select(ExtraLecture)
            .where(
                ExtraLecture.academic_term == term,
                ExtraLecture.faculty_id == faculty_id,
                ExtraLecture.lecture_date >= from_date,
            )
            .options(*_load_options())
            .order_by(ExtraLecture.lecture_date, ExtraLecture.start_time)
        )
        return [to_out(el) for el in (await self.db.execute(stmt)).scalars().all()]

    async def notices_for_student(self, student: User, term: str, from_date: date) -> List[ExtraLectureNotice]:
        """One notice per Extra Lecture of the student's Division dated ``from_date`` or later."""
        if student.division_id is None:
            return []
        lectures = await self.list_for_division(student.division_id, term, from_date)
        return [
            ExtraLectureNotice(
                type="ADDED" if el.status == "SCHEDULED" else "CANCELLED",
                extra_lecture_id=el.id,
                subject_name=el.subject_name,
                date=el.date,
                start_time=el.start_time,
            )
            for el in lectures
        ]
