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
