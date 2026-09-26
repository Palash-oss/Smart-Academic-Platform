import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.db.models import User, ClassSection, PracticalBatch, CourseOffering, Course
from app.services.allotment_service import AllotmentEngine
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def run_allotment_and_assign():
    xlsx_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..", "sample_allotment.xlsx"
    )
    xlsx_path = os.path.normpath(xlsx_path)

    if not os.path.exists(xlsx_path):
        print(f"[-] File not found: {xlsx_path}")
        return

    with open(xlsx_path, "rb") as f:
        file_bytes = f.read()

    async with AsyncSessionLocal() as db:
        print("[*] 1. Processing sample_allotment.xlsx with Allotment Engine...")
        engine = AllotmentEngine(db)
        summary = await engine.process_file(file_bytes, "sample_allotment.xlsx")
        await db.commit()
        print(f"[OK] Processed {summary['total_rows_processed']} rows, {summary['sections_created']} sections, {summary['batches_created']} batches.")

        print("[*] 2. Assigning Prof. David Vance to demo sections and batches...")
        fac_stmt = select(User).where(User.email == "faculty@academic.edu")
        fac_res = await db.execute(fac_stmt)
        fac = fac_res.scalar_one_or_none()

        if not fac:
            print("[-] Faculty not found!")
            return

        # Find sections for 25PCC13CE19 and assign faculty
        off_stmt = (
            select(CourseOffering)
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.sections).selectinload(ClassSection.batches),
                selectinload(CourseOffering.batches),
            )
        )
        off_res = await db.execute(off_stmt)
        offerings = off_res.scalars().all()

        for off in offerings:
            code = off.course.code
            if code == "25PCC13CE19":
                # Advanced DBMS: Assign theory section + batches
                for sec in off.sections:
                    sec.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to Theory Section: {sec.section_name}")
                for b in off.batches[:2]:  # First 2 batches
                    b.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to Lab Batch: {b.batch_name}")

            elif code == "25VSE13CE04":
                # DevOps Lab: Practical only batches
                for b in off.batches[:2]:
                    b.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to DevOps Lab Batch: {b.batch_name}")

            elif code == "25PEC13CE11":
                # Machine Learning: Assign section
                for sec in off.sections[:1]:
                    sec.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to Elective Section: {sec.section_name}")

        await db.commit()
        print("[OK] Demo Faculty assignments complete!")

if __name__ == "__main__":
    asyncio.run(run_allotment_and_assign())
