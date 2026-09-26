import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.db.models import User, ClassSection, PracticalBatch, CourseOffering, Course, StudentEnrollment
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def link_student_enrollments():
    async with AsyncSessionLocal() as db:
        std_stmt = select(User).where(User.email == "student@academic.edu")
        std_res = await db.execute(std_stmt)
        student = std_res.scalar_one_or_none()

        if not student:
            print("Student not found!")
            return

        off_stmt = (
            select(CourseOffering)
            .where(CourseOffering.academic_term == "2026-27-SEM5")
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.sections),
                selectinload(CourseOffering.batches),
                selectinload(CourseOffering.enrollments),
            )
        )
        off_res = await db.execute(off_stmt)
        offerings = off_res.scalars().all()

        for off in offerings:
            # Check existing enrollment
            enr_stmt = select(StudentEnrollment).where(
                StudentEnrollment.student_id == student.id,
                StudentEnrollment.offering_id == off.id,
            )
            enr_res = await db.execute(enr_stmt)
            enr = enr_res.scalar_one_or_none()

            sec = off.sections[0] if off.sections else None
            batch = off.batches[0] if off.batches else None

            if enr is None:
                enr = StudentEnrollment(
                    student_id=student.id,
                    offering_id=off.id,
                    section_id=sec.id if sec else None,
                    batch_id=batch.id if batch else None,
                )
                db.add(enr)
                print(f"[+] Enrolled {student.full_name} into {off.course.code} ({sec.section_name if sec else 'No TH'}, {batch.batch_name if batch else 'No PR'})")
            else:
                enr.section_id = sec.id if sec else None
                enr.batch_id = batch.id if batch else None
                print(f"[*] Updated enrollment for {off.course.code}")

        await db.commit()
        print("[OK] Enrolled student into active demo offerings!")

if __name__ == "__main__":
    asyncio.run(link_student_enrollments())
