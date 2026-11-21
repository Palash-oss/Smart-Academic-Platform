"""Test data factories that write straight to the test database."""
from datetime import date

from app.db.models import ExtraLecture


async def make_extra_lecture(
    db_session,
    seed,
    *,
    faculty="f1",
    division="A",
    subject="OS",
    lecture_date=date(2026, 11, 21),
    start_time="13:30",
    end_time="15:30",
    room_number="703",
    status="SCHEDULED",
) -> ExtraLecture:
    """Insert an Extra Lecture directly, bypassing the API rules (so any teacher/Division combination works)."""
    el = ExtraLecture(
        academic_term=seed.term,
        faculty_id=seed.faculty[faculty].id,
        division_id=seed.division_ids[division],
        offering_id=seed.offering_ids[subject],
        lecture_date=lecture_date,
        start_time=start_time,
        end_time=end_time,
        room_number=room_number,
        status=status,
        attendance_marked=False,
    )
    db_session.add(el)
    await db_session.commit()
    return el
