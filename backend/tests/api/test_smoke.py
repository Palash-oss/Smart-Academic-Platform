"""Smoke tests proving the API harness works end to end."""
from datetime import date

from app.core.clock import today


async def test_faculty_timetable_lists_only_their_slots(faculty_client, seed):
    resp = await faculty_client.get("/api/v1/timetable/faculty/me", params={"academic_term": seed.term})

    assert resp.status_code == 200
    body = resp.json()
    assert body["faculty_id"] == str(seed.faculty["f1"].id)
    lectures = {(s["day_of_week"], s["start_time"], s["course_code"], s["division_name"]) for s in body["upcoming_lectures"]}
    assert lectures == {
        ("Monday", "08:45", "CS501", "COMP-A"),
        ("Wednesday", "09:45", "CS501", "COMP-A"),
    }


async def test_unauthenticated_request_is_rejected(client):
    resp = await client.get("/api/v1/timetable/faculty/me")

    assert resp.status_code == 401


async def test_today_can_be_pinned(pin_today):
    pin_today(date(2026, 12, 5))

    assert today() == date(2026, 12, 5)


async def test_each_authenticated_client_is_the_expected_user(
    faculty_client, other_faculty_client, student_a_client, student_b_client, admin_client, seed
):
    async def whoami(c):
        return (await c.get("/api/auth/me")).json()

    assert (await whoami(faculty_client))["email"] == seed.faculty["f1"].email
    assert (await whoami(other_faculty_client))["email"] == seed.faculty["f2"].email
    assert (await whoami(student_a_client))["roll_no"] == "COMP-A-01"
    assert (await whoami(student_b_client))["roll_no"] == "COMP-B-01"
    assert (await whoami(admin_client))["role"] == "ADMIN"
