"""Schemas for Extra Lectures. ``ExtraLectureOut`` is the one response type used everywhere."""
from __future__ import annotations

import uuid
from datetime import date as date_type
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class ExtraLectureOut(BaseModel):
    id: str
    subject_name: str
    subject_code: str
    faculty_name: str
    division_name: str
    date: date_type
    start_time: str
    end_time: str
    room_number: str
    status: str
    attendance_marked: bool
    hours: int


class ExtraLectureNotice(BaseModel):
    """A bell notice for a student, derived from an Extra Lecture (nothing is stored)."""

    type: str  # "ADDED" | "CANCELLED"
    extra_lecture_id: str
    subject_name: str
    date: date_type
    start_time: str


class ExtraLectureCreate(BaseModel):
    academic_term: str = "2026-27-SEM5"
    division_id: uuid.UUID
    offering_id: uuid.UUID
    lecture_date: date_type
    start_time: str
    end_time: str
    room_number: str = Field(min_length=1, max_length=50)


class ExtraLectureSubjectOption(BaseModel):
    offering_id: str
    subject_name: str
    subject_code: str


class ExtraLectureDivisionOption(BaseModel):
    division_id: str
    division_name: str
    default_room: str
    subjects: List[ExtraLectureSubjectOption]


class ExtraLectureFormOptions(BaseModel):
    divisions: List[ExtraLectureDivisionOption]
    hour_boundaries: List[str]
    upcoming_saturdays: List[date_type]
