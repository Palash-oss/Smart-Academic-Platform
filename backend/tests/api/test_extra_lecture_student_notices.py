"""Extra Lectures: student notices for the notification bell (HTTP API seam)."""
from datetime import date

import pytest

from tests.factories import make_extra_lecture

URL = "/api/v1/timetable/extra-lectures/notices"
MONDAY = date(2026, 11, 16)


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(MONDAY)


async def test_scheduled_extra_lecture_gives_added_notice(student_a_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed, lecture_date=date(2026, 11, 21), start_time="14:30", end_time="15:30")

    resp = await student_a_client.get(URL)

    assert resp.status_code == 200
    notices = resp.json()
    assert len(notices) == 1
    assert notices[0]["type"] == "ADDED"
    assert notices[0]["extra_lecture_id"] == str(el.id)
    assert notices[0]["subject_name"]
    assert notices[0]["date"] == "2026-11-21"
    assert notices[0]["start_time"] == "14:30"


async def test_cancelled_extra_lecture_gives_cancelled_notice(student_a_client, db_session, seed):
    await make_extra_lecture(db_session, seed, status="CANCELLED")

    notices = (await student_a_client.get(URL)).json()

    assert [n["type"] for n in notices] == ["CANCELLED"]


async def test_other_division_is_excluded(student_a_client, db_session, seed):
    await make_extra_lecture(db_session, seed, faculty="f2", division="B", subject="CN")

    assert (await student_a_client.get(URL)).json() == []


async def test_past_dates_are_excluded_and_today_is_included(student_a_client, db_session, seed):
    await make_extra_lecture(db_session, seed, lecture_date=date(2026, 11, 14))
    today_el = await make_extra_lecture(db_session, seed, lecture_date=MONDAY, start_time="16:30", end_time="17:30")

    notices = (await student_a_client.get(URL)).json()

    assert [n["extra_lecture_id"] for n in notices] == [str(today_el.id)]


async def test_non_students_are_rejected(faculty_client, admin_client):
    assert (await faculty_client.get(URL)).status_code == 403
    assert (await admin_client.get(URL)).status_code == 403
