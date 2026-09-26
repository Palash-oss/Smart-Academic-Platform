import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.db.models import User, ClassSection, PracticalBatch, CourseOffering, Course
from app.api.enrollments import faculty_my_subjects
from sqlalchemy import select

async def test_faculty_view():
    async with AsyncSessionLocal() as db:
        fac_stmt = select(User).where(User.email == "faculty@academic.edu")
        fac_res = await db.execute(fac_stmt)
        fac = fac_res.scalar_one_or_none()
        if not fac:
            print("Faculty user not found!")
            return

        res = await faculty_my_subjects(academic_term="2026-27-SEM5", current_user=fac, db=db)
        print("Faculty Response:")
        print(f"  Faculty: {res.faculty_name} ({res.department_name})")
        print(f"  Total Courses: {res.total_courses}")
        print(f"  Total Sections: {res.total_sections}")
        print(f"  Total Batches: {res.total_batches}")
        print(f"  Total Students: {res.total_students}")
        for c in res.courses:
            print(f"  - Course: {c.course_code} {c.course_name} (Tier: {c.tier})")
            for s in c.sections:
                print(f"      Section: {s.section_name} ({s.student_count} students)")
            for b in c.batches:
                print(f"      Batch: {b.batch_name} ({b.student_count} students)")

if __name__ == "__main__":
    asyncio.run(test_faculty_view())
