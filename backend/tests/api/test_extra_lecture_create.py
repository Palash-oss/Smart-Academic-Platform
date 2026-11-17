"""Extra Lectures: creating one and seeing it on the faculty timetable (HTTP API seam)."""
from datetime import date

import pytest

BASE = "/api/v1/timetable"
MONDAY = date(2026, 11, 16)
SAT_THIS_WEEK = "2026-11-21"
SAT_NEXT_WEEK = "2026-11-28"


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(MONDAY)


def payload(seed, **over):
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
    return body


async def create(client, seed, **over):
    return await client.post(f"{BASE}/extra-lectures", json=payload(seed, **over))


async def test_create_returns_the_extra_lecture(faculty_client, seed):
    resp = await create(faculty_client, seed)

    assert resp.status_code == 201
    body = resp.json()
    assert body["subject_name"] == "Operating Systems"
    assert body["subject_code"] == "CS501"
    assert body["faculty_name"] == "Faculty One"
    assert body["division_name"] == "COMP-A"
    assert body["date"] == SAT_THIS_WEEK
    assert (body["start_time"], body["end_time"], body["hours"]) == ("13:30", "15:30", 2)
    assert body["room_number"] == "703"
    assert body["status"] == "SCHEDULED"
    assert body["attendance_marked"] is False


@pytest.mark.parametrize(
    "over, message",
    [
        ({"division_id": "B"}, "Division"),
        ({"offering_id": "CN"}, "subject"),
        ({"lecture_date": "2026-11-20"}, "Saturday"),          # a Friday
        ({"lecture_date": "2026-11-14"}, "after today"),       # past Saturday
        ({"start_time": "13:00"}, "start"),
        ({"start_time": "17:30", "end_time": "17:30"}, "start"),
        ({"start_time": "15:30", "end_time": "14:30"}, "end"),
        ({"end_time": "18:30"}, "end"),
    ],
)
async def test_create_rejects_invalid_requests(faculty_client, seed, over, message):
    if over.get("division_id") == "B":
        over = {"division_id": str(seed.division_ids["B"])}
    if over.get("offering_id") == "CN":
        over = {"offering_id": str(seed.offering_ids["CN"])}

    resp = await create(faculty_client, seed, **over)

    assert 400 <= resp.status_code < 500
    assert message.lower() in resp.json()["detail"].lower()


async def test_saturday_today_is_not_allowed(faculty_client, seed, pin_today):
    pin_today(date(2026, 11, 21))

    resp = await create(faculty_client, seed)

    assert resp.status_code == 400
    assert "after today" in resp.json()["detail"]


async def test_student_cannot_create(student_a_client, seed):
    resp = await create(student_a_client, seed)

    assert resp.status_code == 403


async def test_form_options(faculty_client, seed):
    resp = await faculty_client.get(f"{BASE}/extra-lectures/options", params={"academic_term": seed.term})

    assert resp.status_code == 200
    body = resp.json()
    assert [d["division_name"] for d in body["divisions"]] == ["COMP-A"]
    div = body["divisions"][0]
    assert div["division_id"] == str(seed.division_ids["A"])
    assert div["default_room"] == "703"
    assert [(s["subject_code"], s["offering_id"]) for s in div["subjects"]] == [("CS501", str(seed.offering_ids["OS"]))]
    assert body["hour_boundaries"] == ["13:30", "14:30", "15:30", "16:30", "17:30"]
    assert body["upcoming_saturdays"][:2] == [SAT_THIS_WEEK, SAT_NEXT_WEEK]
    assert all(date.fromisoformat(d).weekday() == 5 and date.fromisoformat(d) > MONDAY for d in body["upcoming_saturdays"])


async def test_my_extra_lectures_lists_from_today_onward(faculty_client, other_faculty_client, seed, db_session):
    await create(faculty_client, seed)
    await create(faculty_client, seed, lecture_date=SAT_NEXT_WEEK)

    mine = (await faculty_client.get(f"{BASE}/extra-lectures/me", params={"academic_term": seed.term})).json()
    theirs = (await other_faculty_client.get(f"{BASE}/extra-lectures/me", params={"academic_term": seed.term})).json()

    assert [e["date"] for e in mine] == [SAT_THIS_WEEK, SAT_NEXT_WEEK]
    assert theirs == []


async def test_this_weeks_extra_lecture_fills_saturday_afternoon_cells(faculty_client, seed):
    await create(faculty_client, seed)

    tt = (await faculty_client.get(f"{BASE}/faculty/me", params={"academic_term": seed.term})).json()

    assert [e["date"] for e in tt["extra_lectures"]] == [SAT_THIS_WEEK]
    sat = tt["schedule"]["Saturday"]
    cell = next(c for c in sat if c["start_time"] == "13:30")
    assert cell["is_extra"] is True
    assert cell["col_span"] == 2
    assert cell["end_time"] == "15:30"
    assert cell["course_code"] == "CS501"
    assert cell["extra_date"] == SAT_THIS_WEEK
    assert [c["start_time"] for c in sat if c["start_time"] in ("14:30", "15:30", "16:30")] == ["15:30", "16:30"]
    assert all(not c.get("is_extra") for c in sat if c["start_time"] in ("15:30", "16:30"))


async def test_later_weeks_appear_only_in_the_list(faculty_client, seed):
    await create(faculty_client, seed, lecture_date=SAT_NEXT_WEEK)

    tt = (await faculty_client.get(f"{BASE}/faculty/me", params={"academic_term": seed.term})).json()

    assert [e["date"] for e in tt["extra_lectures"]] == [SAT_NEXT_WEEK]
    assert not any(c.get("is_extra") for c in tt["schedule"]["Saturday"])


async def test_clearing_and_regenerating_timetable_keeps_extra_lectures(faculty_client, seed):
    await create(faculty_client, seed)

    await faculty_client.post(f"{BASE}/clear", params={"academic_term": seed.term})

    mine = (await faculty_client.get(f"{BASE}/extra-lectures/me", params={"academic_term": seed.term})).json()
    assert len(mine) == 1
