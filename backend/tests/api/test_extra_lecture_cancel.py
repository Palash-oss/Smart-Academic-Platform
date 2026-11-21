"""Extra Lectures: cancelling one (HTTP API seam)."""
from datetime import date

import pytest

BASE = "/api/v1/timetable"
MONDAY = date(2026, 11, 16)
SAT_THIS_WEEK = "2026-11-21"


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(MONDAY)


async def create(client, seed, **over):
    body = {
        "academic_term": seed.term,
        "division_id": str(seed.division_ids["A"]),
        "offering_id": str(seed.offering_ids["OS"]),
        "lecture_date": SAT_THIS_WEEK,
        "start_time": "13:30",
        "end_time": "15:30",
        "room_number": "703",
    }
    body.update(over)
    resp = await client.post(f"{BASE}/extra-lectures", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def cancel(client, extra_lecture_id):
    return await client.post(f"{BASE}/extra-lectures/{extra_lecture_id}/cancel")


async def test_owner_can_cancel(faculty_client, seed):
    el = await create(faculty_client, seed)

    resp = await cancel(faculty_client, el["id"])

    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"
    assert resp.json()["id"] == el["id"]


async def test_admin_can_cancel(faculty_client, admin_client, seed):
    el = await create(faculty_client, seed)

    resp = await cancel(admin_client, el["id"])

    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


async def test_cancel_records_when_it_was_cancelled(faculty_client, seed, db_session):
    from sqlalchemy import select
    from app.db.models import ExtraLecture

    el = await create(faculty_client, seed)
    await cancel(faculty_client, el["id"])

    row = (await db_session.execute(select(ExtraLecture))).scalar_one()
    assert row.cancelled_at is not None


async def test_other_faculty_cannot_cancel(faculty_client, other_faculty_client, seed):
    el = await create(faculty_client, seed)

    resp = await cancel(other_faculty_client, el["id"])

    assert resp.status_code == 403
    mine = (await faculty_client.get(f"{BASE}/extra-lectures/me", params={"academic_term": seed.term})).json()
    assert mine[0]["status"] == "SCHEDULED"


async def test_student_cannot_cancel(faculty_client, student_a_client, seed):
    el = await create(faculty_client, seed)

    resp = await cancel(student_a_client, el["id"])

    assert resp.status_code == 403


async def test_cannot_cancel_twice(faculty_client, seed):
    el = await create(faculty_client, seed)
    await cancel(faculty_client, el["id"])

    resp = await cancel(faculty_client, el["id"])

    assert resp.status_code == 409
    assert "already cancelled" in resp.json()["detail"].lower()


async def test_cannot_cancel_once_the_date_has_passed(faculty_client, seed, pin_today):
    el = await create(faculty_client, seed)
    pin_today(date(2026, 11, 22))

    resp = await cancel(faculty_client, el["id"])

    assert resp.status_code == 409
    assert "passed" in resp.json()["detail"].lower()


async def test_can_cancel_on_the_day_itself(faculty_client, seed, pin_today):
    el = await create(faculty_client, seed)
    pin_today(date(2026, 11, 21))

    resp = await cancel(faculty_client, el["id"])

    assert resp.status_code == 200


async def test_unknown_id_is_404(faculty_client):
    resp = await cancel(faculty_client, "00000000-0000-0000-0000-000000000000")

    assert resp.status_code == 404


async def test_cancelled_lecture_stays_in_my_list_and_timetable(faculty_client, seed):
    el = await create(faculty_client, seed)
    await cancel(faculty_client, el["id"])

    mine = (await faculty_client.get(f"{BASE}/extra-lectures/me", params={"academic_term": seed.term})).json()
    tt = (await faculty_client.get(f"{BASE}/faculty/me", params={"academic_term": seed.term})).json()

    assert [(e["id"], e["status"]) for e in mine] == [(el["id"], "CANCELLED")]
    assert [(e["id"], e["status"]) for e in tt["extra_lectures"]] == [(el["id"], "CANCELLED")]
    cell = next(c for c in tt["schedule"]["Saturday"] if c["start_time"] == "13:30")
    assert cell["is_extra"] is True
    assert cell["extra_status"] == "CANCELLED"
