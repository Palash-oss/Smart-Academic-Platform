"""Extra Lectures: taking attendance with the projector (rolling TOTP) session (HTTP API seam)."""
from datetime import date

import pytest

from tests.factories import make_extra_lecture

START = "/api/attendance/faculty/dynamic-session/start"
CHECKIN = "/api/attendance/student/dynamic-session/checkin"
MY = "/api/attendance/my"
LECTURE_DAY = date(2026, 11, 21)


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(LECTURE_DAY)


def start_body(seed, el=None, **over):
    students = seed.students["A"]
    data = {
        "subject": "Operating Systems",
        "session_date": LECTURE_DAY.isoformat(),
        "division_name": "A",
        "batch_name": "ALL",
        "all_enrolled_student_ids": [str(s.id) for s in students],
    }
    if el is not None:
        data["extra_lecture_id"] = str(el.id)
    data.update(over)
    return data


async def os_record(client):
    records = (await client.get(MY)).json()["subjects"]
    return next(r for r in records if "Operating" in r["subject"])


async def run_session(faculty_client, student_a_client, seed, el):
    started = await faculty_client.post(START, json=start_body(seed, el))
    assert started.status_code == 200, started.text
    sid = started.json()["session_id"]
    code = started.json()["current_code"]
    checkin = await student_a_client.post(CHECKIN, json={"session_id": sid, "code": code})
    assert checkin.status_code == 200, checkin.text
    return sid


async def test_finalize_adds_n_classes_and_sets_flag(faculty_client, student_a_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)  # 2h
    before = await os_record(student_a_client)
    sid = await run_session(faculty_client, student_a_client, seed, el)

    resp = await faculty_client.post(f"/api/attendance/faculty/dynamic-session/{sid}/finalize")

    assert resp.status_code == 200, resp.text
    after = await os_record(student_a_client)
    assert after["total_classes"] == before["total_classes"] + 2
    assert after["attended_classes"] == before["attended_classes"] + 2
    mine = (await faculty_client.get("/api/v1/timetable/extra-lectures/me", params={"academic_term": seed.term})).json()
    assert mine[0]["attendance_marked"] is True


async def test_start_rejected_when_cancelled(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed, status="CANCELLED")

    resp = await faculty_client.post(START, json=start_body(seed, el))

    assert resp.status_code == 409


async def test_start_rejected_when_already_marked(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    el.attendance_marked = True
    await db_session.commit()

    resp = await faculty_client.post(START, json=start_body(seed, el))

    assert resp.status_code == 409


async def test_start_rejected_when_not_today(faculty_client, db_session, seed, pin_today):
    el = await make_extra_lecture(db_session, seed)
    pin_today(date(2026, 11, 20))

    resp = await faculty_client.post(START, json=start_body(seed, el))

    assert resp.status_code == 409


async def test_start_rejected_for_other_faculty(other_faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)

    resp = await other_faculty_client.post(START, json=start_body(seed, el))

    assert resp.status_code == 403


async def test_start_unknown_extra_lecture_404(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)

    resp = await faculty_client.post(
        START, json=start_body(seed, el, extra_lecture_id="00000000-0000-0000-0000-000000000000")
    )

    assert resp.status_code == 404


async def test_session_without_extra_lecture_id_unchanged(faculty_client, student_a_client, db_session, seed):
    before = await os_record(student_a_client)
    started = await faculty_client.post(START, json=start_body(seed))
    assert started.status_code == 200, started.text
    sid = started.json()["session_id"]
    await student_a_client.post(CHECKIN, json={"session_id": sid, "code": started.json()["current_code"]})

    resp = await faculty_client.post(f"/api/attendance/faculty/dynamic-session/{sid}/finalize")

    assert resp.status_code == 200, resp.text
    after = await os_record(student_a_client)
    assert after["total_classes"] == before["total_classes"] + 1


async def test_finalize_after_cancel_rejected(faculty_client, student_a_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    sid = await run_session(faculty_client, student_a_client, seed, el)
    el.status = "CANCELLED"
    await db_session.commit()

    resp = await faculty_client.post(f"/api/attendance/faculty/dynamic-session/{sid}/finalize")

    assert resp.status_code == 409
