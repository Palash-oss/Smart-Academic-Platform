"""Extra Lectures on the student timetable (HTTP API seam)."""
from datetime import date

import pytest

from tests.factories import make_extra_lecture

URL = "/api/v1/timetable/student/me"
MONDAY = date(2026, 11, 16)
SAT_THIS_WEEK = date(2026, 11, 21)
SAT_NEXT_WEEK = date(2026, 11, 28)


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(MONDAY)


async def test_student_sees_own_division_extra_lectures_only(student_a_client, db_session, seed):
    await make_extra_lecture(db_session, seed, division="A", lecture_date=SAT_THIS_WEEK)
    await make_extra_lecture(db_session, seed, faculty="f2", division="B", subject="CN", lecture_date=SAT_NEXT_WEEK)

    resp = await student_a_client.get(URL)

    assert resp.status_code == 200, resp.text
    extras = resp.json()["extra_lectures"]
    assert [e["division_name"] for e in extras] == ["COMP-A"] or all(e["division_name"].endswith("A") for e in extras)
    assert len(extras) == 1
    assert extras[0]["date"] == SAT_THIS_WEEK.isoformat()


async def test_cancelled_extra_lecture_is_included_with_status(student_a_client, db_session, seed):
    await make_extra_lecture(db_session, seed, division="A", lecture_date=SAT_THIS_WEEK, status="CANCELLED")

    extras = (await student_a_client.get(URL)).json()["extra_lectures"]

    assert [e["status"] for e in extras] == ["CANCELLED"]


async def test_this_weeks_extra_lecture_is_placed_in_the_grid(student_a_client, db_session, seed):
    await make_extra_lecture(db_session, seed, division="A", lecture_date=SAT_THIS_WEEK)
    await make_extra_lecture(db_session, seed, division="A", lecture_date=SAT_NEXT_WEEK, start_time="13:30", end_time="14:30")

    saturday = (await student_a_client.get(URL)).json()["schedule"]["Saturday"]

    extra_cells = [c for c in saturday if c["is_extra"]]
    assert [c["extra_date"] for c in extra_cells] == [SAT_THIS_WEEK.isoformat()]
