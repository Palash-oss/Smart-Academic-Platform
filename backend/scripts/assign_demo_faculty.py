import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.db.models import User, ClassSection, PracticalBatch, CourseOffering, Course, StudentEnrollment
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def assign_faculty():
    async with AsyncSessionLocal() as db:
        fac_stmt = select(User).where(User.email == "faculty@academic.edu")
        fac_res = await db.execute(fac_stmt)
        fac = fac_res.scalar_one_or_none()
        if not fac:
            print("Faculty user not found!")
            return

        print(f"[*] Assigning sections & batches to: {fac.full_name} ({fac.id})")

        # 1. Fetch offerings for 2026-27-SEM5
        stmt = (
            select(CourseOffering)
            .where(CourseOffering.academic_term == "2026-27-SEM5")
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.sections),
                selectinload(CourseOffering.batches),
            )
        )
        res = await db.execute(stmt)
        offerings = res.scalars().all()

        if not offerings:
            print("[!] No offerings found yet. Creating demo sections and batches for 2026-27-SEM5...")
            # Create offerings for 25PCC13CE19, 25VSE13CE04, 25PEC13CE11
            courses_stmt = select(Course).where(Course.code.in_(["25PCC13CE19", "25VSE13CE04", "25PEC13CE11"]))
            c_res = await db.execute(courses_stmt)
            courses = c_res.scalars().all()

            for c in courses:
                off = CourseOffering(course_id=c.id, academic_term="2026-27-SEM5")
                db.add(off)
                await db.flush()

                if c.code == "25PCC13CE19":
                    # Theory + 3 batches
                    sec = ClassSection(offering_id=off.id, section_name="CE-A-Theory", faculty_id=fac.id)
                    db.add(sec)
                    await db.flush()
                    b1 = PracticalBatch(offering_id=off.id, section_id=sec.id, batch_name="CE-A-B1", faculty_id=fac.id)
                    b2 = PracticalBatch(offering_id=off.id, section_id=sec.id, batch_name="CE-A-B2", faculty_id=fac.id)
                    b3 = PracticalBatch(offering_id=off.id, section_id=sec.id, batch_name="CE-A-B3", faculty_id=None)
                    db.add_all([b1, b2, b3])

                elif c.code == "25VSE13CE04":
                    # Practical only: 3 batches
                    b1 = PracticalBatch(offering_id=off.id, section_id=None, batch_name="CE-A-Lab1", faculty_id=fac.id)
                    b2 = PracticalBatch(offering_id=off.id, section_id=None, batch_name="CE-A-Lab2", faculty_id=fac.id)
                    b3 = PracticalBatch(offering_id=off.id, section_id=None, batch_name="CE-A-Lab3", faculty_id=None)
                    db.add_all([b1, b2, b3])

                elif c.code == "25PEC13CE11":
                    # Elective: Theory + Batches
                    sec = ClassSection(offering_id=off.id, section_name="PEC-CE-Sec1", faculty_id=fac.id)
                    db.add(sec)
                    await db.flush()
                    b1 = PracticalBatch(offering_id=off.id, section_id=sec.id, batch_name="PEC-B1", faculty_id=fac.id)
                    db.add(b1)

            await db.commit()
            print("[OK] Created offerings, sections, and batches with faculty assignments!")

        else:
            # Update existing sections and batches
            for off in offerings:
                code = off.course.code
                if code == "25PCC13CE19":
                    for sec in off.sections:
                        sec.faculty_id = fac.id
                    for b in off.batches[:2]:
                        b.faculty_id = fac.id
                elif code == "25VSE13CE04":
                    for b in off.batches[:2]:
                        b.faculty_id = fac.id
                elif code == "25PEC13CE11":
                    for sec in off.sections:
                        sec.faculty_id = fac.id
                    for b in off.batches[:1]:
                        b.faculty_id = fac.id

            await db.commit()
            print("[OK] Updated existing offerings with faculty assignments!")

if __name__ == "__main__":
    asyncio.run(assign_faculty())
