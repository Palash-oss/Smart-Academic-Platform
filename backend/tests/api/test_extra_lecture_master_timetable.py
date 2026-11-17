"""Extra Lectures on the admin Master Timetable (HTTP API seam)."""
from datetime import date

import pytest

from tests.factories import make_extra_lecture

URL = "/api/v1/timetable/master"
MONDAY = date(2026, 11, 16)
THIS_SATURDAY = date(2026, 11, 21)
NEXT_SATURDAY = date(2026, 11, 28)


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(MONDAY)


async def master(admin_client, seed, division):
    resp = await admin_client.get(URL, params={"academic_term": seed.term, "division_name": division})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_master_timetable_lists_this_divisions_extra_lectures_only(admin_client, seed, db_session):
    await make_extra_lecture(db_session, seed, division="A", subject="OS")
    await make_extra_lecture(db_session, seed, faculty="f2", division="B", subject="CN")

    body = await master(admin_client, seed, "A")

    assert len(body["extra_lectures"]) == 1
    assert body["extra_lectures"][0]["subject_name"] == "Operating Systems"
    assert body["extra_lectures"][0]["division_name"] == "COMP-A"


async def test_this_weeks_extra_lecture_is_placed_in_saturday_cells(admin_client, seed, db_session):
    await make_extra_lecture(db_session, seed, division="A", start_time="13:30", end_time="15:30")

    body = await master(admin_client, seed, "A")

    extras = [c for c in body["grid"]["Saturday"] if c.get("is_extra")]
    assert len(extras) == 1
    assert extras[0]["start_time"] == "13:30" and extras[0]["end_time"] == "15:30"
    assert extras[0]["col_span"] == 2
    assert extras[0]["extra_date"] == THIS_SATURDAY.isoformat()
    assert extras[0]["extra_status"] == "SCHEDULED"


async def test_later_extra_lecture_is_listed_but_not_in_grid(admin_client, seed, db_session):
    await make_extra_lecture(db_session, seed, division="A", lecture_date=NEXT_SATURDAY)

    body = await master(admin_client, seed, "A")

    assert len(body["extra_lectures"]) == 1
    assert not [c for c in body["grid"]["Saturday"] if c.get("is_extra")]


async def test_cancelled_extra_lecture_is_shown_as_cancelled(admin_client, seed, db_session):
    await make_extra_lecture(db_session, seed, division="A", status="CANCELLED")

    body = await master(admin_client, seed, "A")

    assert body["extra_lectures"][0]["status"] == "CANCELLED"
    extras = [c for c in body["grid"]["Saturday"] if c.get("is_extra")]
    assert extras[0]["extra_status"] == "CANCELLED"


async def test_saturday_mini_project_block_is_unchanged(admin_client, seed, db_session):
    before = await master(admin_client, seed, "A")
    await make_extra_lecture(db_session, seed, division="A")
    after = await master(admin_client, seed, "A")

    morning = lambda b: [c for c in b["grid"]["Saturday"] if c["start_time"] < "13:00"]
    assert morning(before) == morning(after)
