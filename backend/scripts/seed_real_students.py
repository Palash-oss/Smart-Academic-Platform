import asyncio
import csv
import uuid
import os
import sys

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")), override=True)
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env")), override=True)

from sqlalchemy import select, delete, update
from app.db.session import AsyncSessionLocal
from app.db.models import (
    User, Department, Division, Course, CourseOffering, ClassSection, PracticalBatch,
    StudentEnrollment, AttendanceLog
)
from app.core.security import hash_password

async def seed_real_students_and_core():
    async with AsyncSessionLocal() as db:
        print("[1] Loading COMPS Department and Divisions...")
        dept_res = await db.execute(select(Department).where(Department.code == "COMP"))
        dept_comp = dept_res.scalar_one_or_none()
        if not dept_comp:
            dept_comp = Department(id=uuid.uuid4(), code="COMP", name="Computer Engineering")
            db.add(dept_comp)
            await db.flush()

        div_res = await db.execute(select(Division).where(Division.department_id == dept_comp.id))
        divs = {d.name: d for d in div_res.scalars().all()}
        if "A" not in divs:
            div_a = Division(id=uuid.uuid4(), department_id=dept_comp.id, name="A")
            db.add(div_a)
            divs["A"] = div_a
        if "B" not in divs:
            div_b = Division(id=uuid.uuid4(), department_id=dept_comp.id, name="B")
            db.add(div_b)
            divs["B"] = div_b
        await db.flush()

        # [2] Clean up duplicate faculty@academic.edu
        print("[2] Removing duplicate faculty@academic.edu...")
        fac_dup_res = await db.execute(select(User).where(User.email == "faculty@academic.edu"))
        fac_dup = fac_dup_res.scalar_one_or_none()
        if fac_dup:
            await db.execute(update(ClassSection).where(ClassSection.faculty_id == fac_dup.id).values(faculty_id=None))
            await db.execute(update(PracticalBatch).where(PracticalBatch.faculty_id == fac_dup.id).values(faculty_id=None))
            await db.delete(fac_dup)
            await db.flush()

        # [3] Set ADMIN role for Dr. Sujata Deshmukh and Dr. Kalpana Deorukhkar
        print("[3] Setting ADMIN role for Dr. Sujata Deshmukh and Dr. Kalpana Deorukhkar...")
        await db.execute(
            update(User)
            .where(User.email.in_(["sujata.deshmukh@academic.edu", "kalpana.deorukhkar@academic.edu"]))
            .values(role="ADMIN")
        )
        # Ensure other 20 faculty have role="FACULTY"
        await db.execute(
            update(User)
            .where(
                User.role.in_(["FACULTY", "ADMIN"]),
                ~User.email.in_(["sujata.deshmukh@academic.edu", "kalpana.deorukhkar@academic.edu", "admin@academic.edu"])
            )
            .values(role="FACULTY")
        )
        await db.flush()

        # [4] Purge old synthetic students
        print("[4] Purging old student enrollments and accounts...")
        old_students_res = await db.execute(select(User.id).where(User.role == "STUDENT"))
        old_student_ids = [r[0] for r in old_students_res.all()]
        if old_student_ids:
            await db.execute(delete(StudentEnrollment).where(StudentEnrollment.student_id.in_(old_student_ids)))
            await db.execute(delete(AttendanceLog).where(AttendanceLog.student_id.in_(old_student_ids)))
            await db.execute(delete(User).where(User.id.in_(old_student_ids)))
            await db.flush()

        # [5] Read Real Students from CSVs
        pw_hash = hash_password("student123")
        students_by_div = {"A": [], "B": []}

        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        csv_a_path = os.path.join(workspace_root, "comps_a.csv")
        csv_b_path = os.path.join(workspace_root, "comps_b.csv")

        # COMPS A
        with open(csv_a_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for idx, r in enumerate(reader):
                sr_no = int(r["Sr. No."].strip())
                name = r["Student Full Name"].strip()
                email = r["E Mail ID"].strip().lower()
                roll = r["Roll No."].strip()
                erp = f"COMP2024A{sr_no:03d}"
                # 4 Batches for 67 students: B1 (1-17), B2 (18-34), B3 (35-51), B4 (52-67)
                if sr_no <= 17:
                    batch_key = "B1"
                elif sr_no <= 34:
                    batch_key = "B2"
                elif sr_no <= 51:
                    batch_key = "B3"
                else:
                    batch_key = "B4"

                u = User(
                    id=uuid.uuid4(),
                    email=email,
                    hashed_password=pw_hash,
                    full_name=name,
                    role="STUDENT",
                    student_erp_id=erp,
                    roll_no=roll,
                    department_id=dept_comp.id,
                    division_id=divs["A"].id,
                )
                db.add(u)
                students_by_div["A"].append((u, batch_key, roll))

        # COMPS B
        with open(csv_b_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for idx, r in enumerate(reader):
                sr_no = int(r["Sr. No."].strip())
                name = r["Student Full Name"].strip()
                email = r["E Mail ID"].strip().lower()
                roll = r["Roll No."].strip()
                erp = f"COMP2024B{sr_no:03d}"
                # 4 Batches for 72 students: B1 (1-18), B2 (19-36), B3 (37-54), B4 (55-72)
                if sr_no <= 18:
                    batch_key = "B1"
                elif sr_no <= 36:
                    batch_key = "B2"
                elif sr_no <= 54:
                    batch_key = "B3"
                else:
                    batch_key = "B4"

                u = User(
                    id=uuid.uuid4(),
                    email=email,
                    hashed_password=pw_hash,
                    full_name=name,
                    role="STUDENT",
                    student_erp_id=erp,
                    roll_no=roll,
                    department_id=dept_comp.id,
                    division_id=divs["B"].id,
                )
                db.add(u)
                students_by_div["B"].append((u, batch_key, roll))

        # Add demo test accounts for convenience
        demo_student = User(
            id=uuid.uuid4(),
            email="student@academic.edu",
            hashed_password=pw_hash,
            full_name="Demo Student",
            role="STUDENT",
            student_erp_id="COMP2024A000",
            roll_no="10000",
            department_id=dept_comp.id,
            division_id=divs["A"].id,
        )
        db.add(demo_student)
        students_by_div["A"].append((demo_student, "B1", "10000"))

        atrisk_student = User(
            id=uuid.uuid4(),
            email="atrisk.student@academic.edu",
            hashed_password=pw_hash,
            full_name="At Risk Student",
            role="STUDENT",
            student_erp_id="COMP2024A099",
            roll_no="10099",
            department_id=dept_comp.id,
            division_id=divs["A"].id,
        )
        db.add(atrisk_student)
        students_by_div["A"].append((atrisk_student, "B1", "10099"))

        await db.flush()
        print(f"[5] Ingested {len(students_by_div['A'])} COMPS A students and {len(students_by_div['B'])} COMPS B students.")

        # [6] Setup Core Offerings with Theory Teacher matching Practical Batches
        print("[6] Setting up Core Offerings & matching theory-lab teacher allocations...")
        fac_res = await db.execute(select(User).where(User.role.in_(["FACULTY", "ADMIN"])))
        fac_by_email = {u.email.lower(): u for u in fac_res.scalars().all()}

        # 5 Core Courses for Sem 5
        CORE_CONFIG = {
            "25PCC13CE14": {
                "name": "Data Warehousing and Mining",
                "mode": "INTEGRATED_TH_PR",
                "th_a": "sushma.nagdeote@academic.edu",
                "th_b": "sujata.deshmukh@academic.edu",
                # Theory teacher is the same for all practical batches
                "lab_a": ["sushma.nagdeote@academic.edu"] * 4,
                "lab_b": ["sujata.deshmukh@academic.edu"] * 4,
            },
            "25PCC13CE22": {
                "name": "Computer Networks",
                "mode": "INTEGRATED_TH_PR",
                "th_a": "merly.thomas@academic.edu",
                "th_b": "ashok.kanthe@academic.edu",
                "lab_a": ["merly.thomas@academic.edu"] * 4,
                "lab_b": ["ashok.kanthe@academic.edu"] * 4,
            },
            "25PCC13CE19": {
                "name": "Cryptography and System Security",
                "mode": "INTEGRATED_TH_PR",
                "th_a": "monica.khanore@academic.edu",
                "th_b": "monali.shetty@academic.edu",
                "lab_a": ["monica.khanore@academic.edu"] * 4,
                "lab_b": ["monali.shetty@academic.edu"] * 4,
            },
            "25PCC13CE21": {
                "name": "Theory of Computer Science",
                "mode": "THEORY_TUTORIAL",
                "th_a": "kalpana.deorukhkar@academic.edu",
                "th_b": "ankita.amburle@academic.edu",
                "lab_a": ["kalpana.deorukhkar@academic.edu"] * 4,
                "lab_b": ["ankita.amburle@academic.edu"] * 4,
            },
            "25VSE13CE04": {
                "name": "Cloud Computing Laboratory",
                "mode": "PRACTICAL_ONLY",
                "th_a": None,
                "th_b": None,
                "lab_a": [
                    "supriya.kamoji@academic.edu",
                    "supriya.kamoji@academic.edu",
                    "vijay.shelake@academic.edu",
                    "vijay.shelake@academic.edu",
                ],
                "lab_b": [
                    "unik.lokhande@academic.edu",
                    "unik.lokhande@academic.edu",
                    "vijay.shelake@academic.edu",
                    "vijay.shelake@academic.edu",
                ],
            },
        }

        # Clear existing core sections and batches
        core_codes = list(CORE_CONFIG.keys())
        courses_res = await db.execute(select(Course).where(Course.code.in_(core_codes)))
        courses = {c.code: c for c in courses_res.scalars().all()}

        sections_by_course_div = {}
        batches_by_course_div_b = {}
        offerings_by_code = {}

        for code, conf in CORE_CONFIG.items():
            course = courses.get(code)
            if not course:
                continue

            off_res = await db.execute(
                select(CourseOffering).where(
                    CourseOffering.course_id == course.id,
                    CourseOffering.academic_term == "2026-27-SEM5"
                )
            )
            off = off_res.scalar_one_or_none()
            if not off:
                off = CourseOffering(
                    id=uuid.uuid4(),
                    course_id=course.id,
                    department_id=dept_comp.id,
                    academic_term="2026-27-SEM5",
                )
                db.add(off)
                await db.flush()
            offerings_by_code[code] = off

            # Clean old sections and batches
            await db.execute(delete(PracticalBatch).where(PracticalBatch.offering_id == off.id))
            await db.execute(delete(ClassSection).where(ClassSection.offering_id == off.id))
            await db.flush()

            # Sections
            sec_a, sec_b = None, None
            if conf["th_a"]:
                sec_a = ClassSection(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_name="COMP-A-Theory",
                    faculty_id=fac_by_email[conf["th_a"]].id if conf["th_a"] in fac_by_email else None,
                )
                db.add(sec_a)
                sections_by_course_div[(code, "A")] = sec_a

            if conf["th_b"]:
                sec_b = ClassSection(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_name="COMP-B-Theory",
                    faculty_id=fac_by_email[conf["th_b"]].id if conf["th_b"] in fac_by_email else None,
                )
                db.add(sec_b)
                sections_by_course_div[(code, "B")] = sec_b

            await db.flush()

            # Batches for A (B1..B4)
            for idx, b_name in enumerate(["B1", "B2", "B3", "B4"]):
                fac_email = conf["lab_a"][idx]
                fac_user = fac_by_email.get(fac_email)
                b_obj = PracticalBatch(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_id=sec_a.id if sec_a else None,
                    batch_name=f"COMP-A-{b_name}",
                    faculty_id=fac_user.id if fac_user else None,
                )
                db.add(b_obj)
                batches_by_course_div_b[(code, "A", b_name)] = b_obj

            # Batches for B (B1..B4)
            for idx, b_name in enumerate(["B1", "B2", "B3", "B4"]):
                fac_email = conf["lab_b"][idx]
                fac_user = fac_by_email.get(fac_email)
                b_obj = PracticalBatch(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_id=sec_b.id if sec_b else None,
                    batch_name=f"COMP-B-{b_name}",
                    faculty_id=fac_user.id if fac_user else None,
                )
                db.add(b_obj)
                batches_by_course_div_b[(code, "B", b_name)] = b_obj

            await db.flush()

        # [7] Auto-Enroll all real students into Core Courses
        print("[7] Auto-enrolling all real students into the 5 core courses...")
        for div_name in ["A", "B"]:
            for u, batch_key, roll in students_by_div[div_name]:
                for code in CORE_CONFIG.keys():
                    course = courses[code]
                    off = offerings_by_code[code]

                    sec = sections_by_course_div.get((code, div_name))
                    batch = batches_by_course_div_b.get((code, div_name, batch_key))

                    enr = StudentEnrollment(
                        id=uuid.uuid4(),
                        student_id=u.id,
                        offering_id=off.id,
                        section_id=sec.id if sec else None,
                        batch_id=batch.id if batch else None,
                    )
                    db.add(enr)

                    # Initial attendance baseline (~88-92%)
                    log = AttendanceLog(
                        id=uuid.uuid4(),
                        student_id=u.id,
                        course_id=course.id,
                        subject=f"{course.name} ({course.code})",
                        total_classes=28,
                        attended_classes=25,
                    )
                    db.add(log)

        await db.commit()
        print("[*] Migration and Seeding of Real College Students & Faculty Complete!")

if __name__ == "__main__":
    asyncio.run(seed_real_students_and_core())
