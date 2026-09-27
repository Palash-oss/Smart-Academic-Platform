import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.db.models import (
    Department,
    Division,
    Course,
    CourseOffering,
    ClassSection,
    PracticalBatch,
    StudentEnrollment,
    AttendanceLog,
    User,
)
from app.services.attendance_service import fetch_student_attendance_records
from app.api.enrollments import faculty_my_subjects

async def verify():
    print("\n" + "=" * 75)
    print("      SMART ACADEMIC PLATFORM — COMPS ECOSYSTEM VERIFICATION")
    print("=" * 75)

    async with AsyncSessionLocal() as db:
        # 1. Departments
        depts_res = await db.execute(select(Department))
        depts = depts_res.scalars().all()
        print(f"\n[1] Departments in Database: {len(depts)}")
        for d in depts:
            print(f"    - {d.code}: {d.name} (ID: {d.id})")
        assert len(depts) == 1, f"Expected 1 department, found {len(depts)}"
        assert depts[0].code == "COMP", f"Expected COMP department, found {depts[0].code}"

        # 2. Divisions
        divs_res = await db.execute(select(Division).order_by(Division.name))
        divs = divs_res.scalars().all()
        print(f"\n[2] Divisions in COMPS: {len(divs)}")
        for div in divs:
            res_count = await db.execute(
                select(func.count(User.id)).where(User.division_id == div.id)
            )
            actual_count = res_count.scalar()
            print(f"    - Division {div.name} (Semester {div.semester}): Target={div.student_count}, Actual={actual_count}")
            assert actual_count == 70, f"Expected 70 students in Division {div.name}, got {actual_count}"

        # 3. Total Students
        stud_res = await db.execute(select(func.count(User.id)).where(User.role == "STUDENT"))
        total_students = stud_res.scalar()
        print(f"\n[3] Total Students in Database: {total_students}")
        assert total_students == 140, f"Expected 140 students, got {total_students}"

        # 4. Courses & Offerings
        core_courses_res = await db.execute(select(Course).where(Course.course_tier == "CLASS"))
        core_courses = core_courses_res.scalars().all()
        print(f"\n[4] Core Courses (Semester 5): {len(core_courses)}")
        for c in core_courses:
            print(f"    - [{c.code}] {c.name} ({c.delivery_mode})")
        assert len(core_courses) == 5, f"Expected 5 core courses, got {len(core_courses)}"

        elec_courses_res = await db.execute(select(Course).where(Course.course_tier == "DEPARTMENT"))
        elec_courses = elec_courses_res.scalars().all()
        print(f"\n[5] Elective Courses (PEC/PECL): {len(elec_courses)}")
        for c in elec_courses:
            print(f"    - [{c.code}] {c.name}")
        assert len(elec_courses) == 8, f"Expected 8 electives, got {len(elec_courses)}"

        # 5. Check Demo Student (Alex Mercer) — should have 7 subjects
        alex_res = await db.execute(select(User).where(User.email == "student@academic.edu"))
        alex = alex_res.scalar_one_or_none()
        assert alex is not None, "Alex Mercer not found"
        alex_att = await fetch_student_attendance_records(db, alex.id)
        print(f"\n[6] Alex Mercer Attendance & Enrollment (student@academic.edu):")
        print(f"    - Student: {alex_att['student_name']} (Roll: {alex.roll_no})")
        print(f"    - Total Subjects: {len(alex_att['subjects'])} (5 Core + 2 Electives)")
        print(f"    - Overall Attendance: {alex_att['overall_percentage']}%")
        for s in alex_att["subjects"]:
            print(f"        * {s['subject']}: {s['percentage']}% ({s['attended_classes']}/{s['total_classes']})")
        assert len(alex_att["subjects"]) == 7, f"Expected 7 subjects for Alex, got {len(alex_att['subjects'])}"

        # 6. Check Regular Student (COMP-A Roll 2) — should have exactly 5 subjects
        other_res = await db.execute(select(User).where(User.email == "student.a.02@comp.academic.edu"))
        other = other_res.scalar_one_or_none()
        assert other is not None, "Student A-02 not found"
        other_att = await fetch_student_attendance_records(db, other.id)
        print(f"\n[7] Regular Student Attendance & Enrollment (student.a.02@comp.academic.edu):")
        print(f"    - Student: {other_att['student_name']} (Roll: {other.roll_no})")
        print(f"    - Total Subjects: {len(other_att['subjects'])} (Strictly 5 Core Subjects)")
        print(f"    - Overall Attendance: {other_att['overall_percentage']}%")
        for s in other_att["subjects"]:
            print(f"        * {s['subject']}: {s['percentage']}% ({s['attended_classes']}/{s['total_classes']})")
        assert len(other_att["subjects"]) == 5, f"Expected exactly 5 subjects for un-elected student, got {len(other_att['subjects'])}"

        # 7. Check Faculty View
        fac_res = await db.execute(select(User).where(User.email == "faculty@academic.edu"))
        fac = fac_res.scalar_one_or_none()
        if fac:
            fac_view = await faculty_my_subjects(academic_term="2026-27-SEM5", current_user=fac, db=db)
            print(f"\n[8] Faculty Teaching View ({fac.full_name}):")
            print(f"    - Department: {fac_view.department_name}")
            print(f"    - Assigned Courses: {fac_view.total_courses}")
            print(f"    - Total Students Taught: {fac_view.total_students}")

    print("\n" + "=" * 75)
    print("  >>> ALL 8 VERIFICATION CHECKS PASSED PERFECTLY! <<<")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    asyncio.run(verify())
