"""Extra Lectures: taking attendance by manual marking (HTTP API seam)."""
from datetime import date

import pytest

from tests.factories import make_extra_lecture

MARK = "/api/attendance/faculty/mark"
MY = "/api/attendance/my"
LECTURE_DAY = date(2026, 11, 21)


@pytest.fixture(autouse=True)
def today(pin_today):
    pin_today(LECTURE_DAY)


def body(seed, el, present=1, with_id=True, **over):
    students = seed.students["A"]
    data = {
        "subject": "Operating Systems",
        "session_date": el.lecture_date.isoformat(),
        "present_student_ids": [str(s.id) for s in students[:present]],
        "all_enrolled_student_ids": [str(s.id) for s in students],
    }
    if with_id:
        data["extra_lecture_id"] = str(el.id)
    data.update(over)
    return data


async def os_record(client):
    records = (await client.get(MY)).json()["subjects"]
    return next(r for r in records if "Operating" in r["subject"])


async def test_two_hour_lecture_adds_two_classes(faculty_client, student_a_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)  # 13:30-15:30 = 2h
    before = await os_record(student_a_client)

    resp = await faculty_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 200, resp.text
    after = await os_record(student_a_client)  # the first student is marked present
    assert after["total_classes"] == before["total_classes"] + 2
    assert after["attended_classes"] == before["attended_classes"] + 2


async def test_absent_student_gets_total_only(faculty_client, student_a_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    before = await os_record(student_a_client)

    resp = await faculty_client.post(MARK, json=body(seed, el, present=0))

    assert resp.status_code == 200, resp.text
    after = await os_record(student_a_client)
    assert after["total_classes"] == before["total_classes"] + 2
    assert after["attended_classes"] == before["attended_classes"]


async def test_sets_attendance_marked_flag(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)

    await faculty_client.post(MARK, json=body(seed, el))

    mine = (await faculty_client.get("/api/v1/timetable/extra-lectures/me", params={"academic_term": seed.term})).json()
    assert mine[0]["attendance_marked"] is True


async def test_exempt_from_daily_cap(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    for _ in range(2):
        assert (await faculty_client.post(MARK, json=body(seed, el, with_id=False))).status_code == 200

    resp = await faculty_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 200, resp.text


async def test_third_normal_session_still_rejected(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    for _ in range(2):
        await faculty_client.post(MARK, json=body(seed, el, with_id=False))

    resp = await faculty_client.post(MARK, json=body(seed, el, with_id=False))

    assert resp.status_code == 400


async def test_cannot_mark_twice(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    await faculty_client.post(MARK, json=body(seed, el))

    resp = await faculty_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 409


async def test_cannot_mark_cancelled(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed, status="CANCELLED")

    resp = await faculty_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 409


async def test_cannot_mark_when_not_today(faculty_client, db_session, seed, pin_today):
    el = await make_extra_lecture(db_session, seed)
    pin_today(date(2026, 11, 20))

    resp = await faculty_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 409


async def test_other_faculty_rejected(other_faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)

    resp = await other_faculty_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 403


async def test_admin_allowed(admin_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)

    resp = await admin_client.post(MARK, json=body(seed, el))

    assert resp.status_code == 200, resp.text


async def test_unknown_extra_lecture_404(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)

    resp = await faculty_client.post(
        MARK, json=body(seed, el, extra_lecture_id="00000000-0000-0000-0000-000000000000")
    )

    assert resp.status_code == 404


async def test_extra_lecture_does_not_use_up_normal_daily_cap(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    assert (await faculty_client.post(MARK, json=body(seed, el))).status_code == 200

    for _ in range(2):
        resp = await faculty_client.post(MARK, json=body(seed, el, with_id=False))
        assert resp.status_code == 200, resp.text

    # ...and the cap still bites on the third normal session
    assert (await faculty_client.post(MARK, json=body(seed, el, with_id=False))).status_code == 400


async def test_students_from_another_division_rejected(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)  # Division A
    outsider = str(seed.students["B"][0].id)

    resp = await faculty_client.post(
        MARK, json=body(seed, el, all_enrolled_student_ids=[outsider], present_student_ids=[outsider])
    )

    assert resp.status_code == 400
    assert (await db_session.get(type(el), el.id)).attendance_marked is False


async def test_present_students_must_be_enrolled(faculty_client, db_session, seed):
    el = await make_extra_lecture(db_session, seed)
    students = seed.students["A"]

    resp = await faculty_client.post(
        MARK,
        json=body(
            seed, el,
            all_enrolled_student_ids=[str(students[0].id)],
            present_student_ids=[str(seed.students["B"][0].id)],
        ),
    )

    assert resp.status_code == 400
