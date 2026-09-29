import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import AsyncSessionLocal
from app.services.allotment_service import AllotmentEngine
from app.services.attendance_service import fetch_all_students_faculty_overview
from sqlalchemy import select
from app.db.models import User, StudentEnrollment, CourseOffering, Course, ClassSection, PracticalBatch

async def test_allotment():
    async with AsyncSessionLocal() as db:
        print("[1] Reading generated CSV...")
        csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "allotment_sem5_student_choices.csv"))
        with open(csv_path, "rb") as f:
            file_bytes = f.read()

        print("[2] Running AllotmentEngine.process_allotment_file...")
        service = AllotmentEngine(db)
        result = await service.process_file(file_bytes, "allotment_sem5_student_choices.csv")
        print("Result status:", result.get("status"))
        print("Rows processed:", result.get("total_rows_processed"))
        print("Sections created:", result.get("sections_created"))
        print("Batches created:", result.get("batches_created"))
        print("Faculty slots:", result.get("faculty_slots_generated"))
        print("Notices:", len(result.get("notices", [])))
        for n in result.get("notices", []):
            print("  *", n)
        print("Errors:", len(result.get("errors", [])))
        for e in result.get("errors", []):
            print("  !", e)

        print("\n[3] Checking student Palash electives...")
        palash_res = await db.execute(select(User).where(User.roll_no == "10265"))
        palash = palash_res.scalar_one_or_none()
        if palash:
            enr_res = await db.execute(
                select(StudentEnrollment, CourseOffering, Course)
                .join(CourseOffering, StudentEnrollment.offering_id == CourseOffering.id)
                .join(Course, CourseOffering.course_id == Course.id)
                .where(StudentEnrollment.student_id == palash.id)
            )
            print(f"Palash ({palash.full_name}, {palash.email}) enrolled courses:")
            for enr, off, crs in enr_res.all():
                print(f"  - {crs.code} ({crs.name}) [{crs.course_tier}]")

        print("\n[4] Checking faculty Dr. Smita Ambarkar subjects...")
        smita_res = await db.execute(select(User).where(User.email == "smita.ambarkar@academic.edu"))
        smita = smita_res.scalar_one_or_none()
        if smita:
            overview = await fetch_all_students_faculty_overview(db, faculty_user=smita)
            print(f"Dr. Smita Ambarkar overview: {len(overview)} students visible in her portal.")
            if overview:
                print(f"Sample student in Smita's class: {overview[0]['student_name']} ({overview[0]['roll_no']}) - Courses: {overview[0]['course_codes']}")

if __name__ == "__main__":
    asyncio.run(test_allotment())
