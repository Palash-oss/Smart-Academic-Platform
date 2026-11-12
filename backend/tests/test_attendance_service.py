import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.services.attendance_service import (
    calculate_attendance_percentage,
    is_attendance_at_risk,
    calculate_classes_needed_for_target
)


def test_calculate_attendance_percentage():
    assert calculate_attendance_percentage(15, 20) == 75.0
    assert calculate_attendance_percentage(14, 20) == 70.0
    assert calculate_attendance_percentage(18, 20) == 90.0
    assert calculate_attendance_percentage(0, 0) == 0.0
    assert calculate_attendance_percentage(1, 3) == 33.33


def test_is_attendance_at_risk():
    assert is_attendance_at_risk(74.9) is True
    assert is_attendance_at_risk(70.0) is True
    assert is_attendance_at_risk(75.0) is False
    assert is_attendance_at_risk(85.0) is False


def test_calculate_classes_needed_for_target():
    # 14 out of 20 = 70%. Need 75%.
    # (14 + x) / (20 + x) >= 0.75 => 14 + x >= 15 + 0.75x => 0.25x >= 1 => x = 4
    assert calculate_classes_needed_for_target(14, 20, 75.0) == 4
    
    # 15 out of 20 = 75%. Already at 75%.
    assert calculate_classes_needed_for_target(15, 20, 75.0) == 0
    
    # 10 out of 20 = 50%.
    # (10 + x) / (20 + x) >= 0.75 => 0.25x >= 5 => x = 20
    assert calculate_classes_needed_for_target(10, 20, 75.0) == 20


def test_fetch_previous_lecture_session_found_and_not_found():
    import asyncio
    import uuid
    from datetime import datetime
    from unittest.mock import AsyncMock, MagicMock
    from app.services.attendance_service import fetch_previous_lecture_session
    from app.db.models import LectureSession

    faculty_id = uuid.uuid4()
    sess_id = uuid.uuid4()
    p1, p2 = str(uuid.uuid4()), str(uuid.uuid4())
    p3 = str(uuid.uuid4())

    mock_session_obj = MagicMock(spec=LectureSession)
    mock_session_obj.id = sess_id
    mock_session_obj.subject = "Operating Systems (CS501)"
    mock_session_obj.session_date = "2026-08-23"
    mock_session_obj.session_number = 2
    mock_session_obj.present_student_ids = [p1, p2]
    mock_session_obj.all_enrolled_student_ids = [p1, p2, p3]
    mock_session_obj.created_at = datetime(2026, 8, 23, 11, 30, 0)

    # Case 1: Found
    mock_res_found = MagicMock()
    mock_res_found.scalar_one_or_none.return_value = mock_session_obj
    db_found = AsyncMock()
    db_found.execute.return_value = mock_res_found

    res_found = asyncio.run(
        fetch_previous_lecture_session(db_found, faculty_id, "Operating Systems", before_date="2026-08-24")
    )
    assert res_found["found"] is True
    assert res_found["session_id"] == str(sess_id)
    assert res_found["session_date"] == "2026-08-23"
    assert res_found["session_number"] == 2
    assert res_found["present_student_ids"] == [p1, p2]
    assert res_found["present_count"] == 2
    assert res_found["total_enrolled"] == 3

    # Case 2: Not found
    mock_res_empty = MagicMock()
    mock_res_empty.scalar_one_or_none.return_value = None
    db_empty = AsyncMock()
    db_empty.execute.return_value = mock_res_empty

    res_empty = asyncio.run(
        fetch_previous_lecture_session(db_empty, faculty_id, "Operating Systems", before_date="2026-08-24")
    )
    assert res_empty == {"found": False}
