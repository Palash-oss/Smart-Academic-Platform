"""Extra Lectures: clash detection on create (HTTP API seam)."""
from datetime import date

import pytest

from tests.factories import make_extra_lecture

BASE = "/api/v1/timetable"
MONDAY = date(2026, 11, 16)
SATURDAY = date(2026, 11, 21)


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(MONDAY)


async def create(client, seed, **over):
    body = {
        "academic_term": seed.term,
        "division_id": str(seed.division_ids["A"]),
        "offering_id": str(seed.offering_ids["OS"]),
        "lecture_date": SATURDAY.isoformat(),
        "start_time": "13:30",
        "end_time": "15:30",
        "room_number": "703",
    }
    body.update(over)
    return await client.post(f"{BASE}/extra-lectures", json=body)


async def test_teacher_clash_is_rejected_naming_the_conflict(faculty_client, seed, db_session):
    await make_extra_lecture(db_session, seed, start_time="14:30", end_time="16:30")

    resp = await create(faculty_client, seed)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert "Operating Systems" in detail
    assert "14:30" in detail and "16:30" in detail
    assert "COMP-A" in detail


async def test_division_clash_with_another_faculty_is_rejected_naming_the_conflict(faculty_client, seed, db_session):
    await make_extra_lecture(db_session, seed, faculty="f2", subject="CN", start_time="14:30", end_time="15:30")

    resp = await create(faculty_client, seed)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert "Computer Networks" in detail
    assert "14:30" in detail and "15:30" in detail
    assert "Faculty Two" in detail


async def test_touching_ranges_are_allowed(faculty_client, seed, db_session):
    await make_extra_lecture(db_session, seed, start_time="13:30", end_time="14:30")

    resp = await create(faculty_client, seed, start_time="14:30", end_time="15:30")

    assert resp.status_code == 201


async def test_same_time_on_a_different_date_is_allowed(faculty_client, seed, db_session):
    await make_extra_lecture(db_session, seed)

    resp = await create(faculty_client, seed, lecture_date="2026-11-28")

    assert resp.status_code == 201


async def test_creating_over_a_cancelled_lecture_succeeds(faculty_client, seed, db_session):
    await make_extra_lecture(db_session, seed, status="CANCELLED")
    await make_extra_lecture(db_session, seed, faculty="f2", subject="CN", status="CANCELLED")

    resp = await create(faculty_client, seed)

    assert resp.status_code == 201
