"""
Complete Clean College Academic Ecosystem Setup
================================================
Aligns 100% with Fr. CRCE Syllabus (Revision FRCRCE-3-26):
1. Creates authentic department faculty members
2. Creates 140 COMP students (COMP-A: 70, COMP-B: 70) with roll numbers & ERP IDs
3. Auto-enrolls ALL students into 5 mandatory Core Sem-5 subjects
4. Generates a realistic Google Form Elective CSV (sample_google_form_pec_allotment.csv)
5. Processes elective allotment so students have their chosen electives
6. Allocates faculty to Division Theory sections and Lab Batches (both auto and manual ready)
7. Normalizes attendance strictly to active enrolled subjects (Zero Sem-6 leaks)
"""

import asyncio
import os
import sys
import uuid
import random
import pandas as pd
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.db.models import (
    Department, Division, Course, CourseOffering, ClassSection, PracticalBatch,
    StudentEnrollment, User, AttendanceLog, LectureSession
)
from app.core.security import hash_password
from app.services.allotment_service import AllotmentEngine


FACULTY_MEMBERS = [
    {
        "email": "faculty@academic.edu",
        "full_name": "Prof. David Vance",
        "specialty": "Cryptography & System Security"
    },
    {
        "email": "anita.kulkarni@academic.edu",
        "full_name": "Prof. Anita Kulkarni",
        "specialty": "Theory of Computer Science"
    },
    {
        "email": "rajesh.iyer@academic.edu",
        "full_name": "Prof. Rajesh Iyer",
        "specialty": "Computer Networks"
    },
    {
        "email": "sneha.deshmukh@academic.edu",
        "full_name": "Prof. Sneha Deshmukh",
        "specialty": "Data Warehousing & Mining"
    },
    {
        "email": "vikram.malhotra@academic.edu",
        "full_name": "Prof. Vikram Malhotra",
        "specialty": "Cloud Computing & DevOps"
    },
    {
        "email": "priya.sharma@academic.edu",
        "full_name": "Prof. Priya Sharma",
        "specialty": "Blockchain & Cyber Security"
    },
    {
        "email": "arjun.nair@academic.edu",
        "full_name": "Prof. Arjun Nair",
        "specialty": "Deep Learning & AI"
    },
]

INDIAN_STUDENT_NAMES = [
    ("Aarav", "Sharma"), ("Vihaan", "Patel"), ("Aditya", "Verma"), ("Sai", "Gupta"), ("Reyansh", "Singh"),
    ("Ananya", "Rao"), ("Diya", "Nair"), ("Priya", "Joshi"), ("Riya", "Kulkarni"), ("Kavya", "Deshmukh"),
    ("Rohan", "Mehta"), ("Dev", "Agarwal"), ("Arjun", "Bhatia"), ("Kabir", "Reddy"), ("Karan", "Chowdhury"),
    ("Siddharth", "Mukherjee"), ("Ishaan", "Banerjee"), ("Neha", "Kapoor"), ("Pooja", "Malhotra"), ("Sneha", "Saxena"),
    ("Liam", "Smith"), ("Noah", "Johnson"), ("Oliver", "Williams"), ("Elijah", "Brown"), ("James", "Jones"),
    ("William", "Garcia"), ("Benjamin", "Miller"), ("Lucas", "Davis"), ("Henry", "Rodriguez"), ("Alexander", "Martinez"),
    ("Mason", "Hernandez"), ("Michael", "Lopez"), ("Ethan", "Gonzalez"), ("Daniel", "Wilson"), ("Jacob", "Anderson"),
    ("Logan", "Thomas"), ("Jackson", "Taylor"), ("Levi", "Moore"), ("Sebastian", "Jackson"), ("Mateo", "Martin"),
    ("Emma", "Lee"), ("Olivia", "Perez"), ("Ava", "Thompson"), ("Sophia", "White"), ("Isabella", "Harris"),
    ("Charlotte", "Sanchez"), ("Amelia", "Clark"), ("Mia", "Ramirez"), ("Harper", "Lewis"), ("Evelyn", "Robinson"),
    ("Abigail", "Walker"), ("Emily", "Young"), ("Ella", "Allen"), ("Elizabeth", "King"), ("Camila", "Wright"),
    ("Luna", "Scott"), ("Sofia", "Torres"), ("Avery", "Nguyen"), ("Mila", "Hill"), ("Aria", "Flores"),
    ("Scarlett", "Green"), ("Penelope", "Adams"), ("Layla", "Baker"), ("Chloe", "Gonzalez"), ("Victoria", "Nelson"),
    ("Madison", "Carter"), ("Eleanor", "Mitchell"), ("Grace", "Perez"), ("Nora", "Roberts"), ("Riley", "Turner")
]


async def run_clean_setup():
    academic_term = "2026-27-SEM5"
    print("=" * 80)
    print("SETTING UP CLEAN ACADEMIC PLATFORM ECOSYSTEM")
    print(f"Academic Term: {academic_term}")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        # 1. Fetch Department & Divisions
        comp_res = await db.execute(select(Department).where(Department.code == "COMP"))
        comp_dept = comp_res.scalar_one()

        div_a_res = await db.execute(select(Division).where(Division.department_id == comp_dept.id, Division.name == "A"))
        div_a = div_a_res.scalar_one()

        div_b_res = await db.execute(select(Division).where(Division.department_id == comp_dept.id, Division.name == "B"))
        div_b = div_b_res.scalar_one_or_none()
        if not div_b:
            div_b = Division(department_id=comp_dept.id, name="B", semester=5, student_count=70)
            db.add(div_b)
            await db.flush()

        # 2. Sync Faculty Members
        print("[*] 1. Syncing Faculty Roster...")
        faculty_users = {}
        for f_info in FACULTY_MEMBERS:
            res = await db.execute(select(User).where(User.email == f_info["email"]))
            fac = res.scalar_one_or_none()
            if not fac:
                fac = User(
                    email=f_info["email"],
                    hashed_password=hash_password("faculty123"),
                    full_name=f_info["full_name"],
                    role="FACULTY",
                    department_id=comp_dept.id
                )
                db.add(fac)
                await db.flush()
            else:
                fac.full_name = f_info["full_name"]
                fac.department_id = comp_dept.id
                fac.hashed_password = hash_password("faculty123")
                await db.flush()
            faculty_users[fac.email] = fac
        print(f"  [OK] Synchronized {len(faculty_users)} Faculty members.")

        # 3. Create / Sync 70 students for COMP-A and 70 for COMP-B
        print("[*] 2. Syncing 70 Students in COMP-A and 70 in COMP-B...")
        pwd_hash = hash_password("student123")

        students_a = []
        students_b = []

        # Division A: 70 students
        for i in range(1, 71):
            erp = f"2023CE{i:03d}"
            roll = f"CE-A-{i:02d}"
            if i == 1:
                # Alex Mercer (Demo student)
                email = "student@academic.edu"
                name = "Alex Mercer"
            elif i == 15:
                # Rahul Sharma (At-Risk student)
                email = "atrisk.student@academic.edu"
                name = "Rahul Sharma"
            else:
                fn, ln = INDIAN_STUDENT_NAMES[(i - 1) % len(INDIAN_STUDENT_NAMES)]
                email = f"{fn.lower()}.{ln.lower()}.{i}@student.academic.edu"
                name = f"{fn} {ln}"

            res = await db.execute(select(User).where(User.email == email))
            u = res.scalar_one_or_none()
            if not u:
                u = User(
                    email=email,
                    hashed_password=pwd_hash,
                    full_name=name,
                    role="STUDENT",
                    student_erp_id=erp,
                    roll_no=roll,
                    department_id=comp_dept.id,
                    division_id=div_a.id
                )
                db.add(u)
                await db.flush()
            else:
                u.full_name = name
                u.student_erp_id = erp
                u.roll_no = roll
                u.department_id = comp_dept.id
                u.division_id = div_a.id
                await db.flush()
            students_a.append(u)

        # Division B: 70 students
        for i in range(1, 71):
            erp = f"2023CE{100 + i:03d}"
            roll = f"CE-B-{i:02d}"
            fn, ln = INDIAN_STUDENT_NAMES[(i + 15) % len(INDIAN_STUDENT_NAMES)]
            email = f"{fn.lower()}.{ln.lower()}.b{i}@student.academic.edu"
            name = f"{fn} {ln}"

            res = await db.execute(select(User).where(User.email == email))
            u = res.scalar_one_or_none()
            if not u:
                u = User(
                    email=email,
                    hashed_password=pwd_hash,
                    full_name=name,
                    role="STUDENT",
                    student_erp_id=erp,
                    roll_no=roll,
                    department_id=comp_dept.id,
                    division_id=div_b.id
                )
                db.add(u)
                await db.flush()
            else:
                u.full_name = name
                u.student_erp_id = erp
                u.roll_no = roll
                u.department_id = comp_dept.id
                u.division_id = div_b.id
                await db.flush()
            students_b.append(u)

        print(f"  [OK] Successfully synchronized 140 Students across COMP-A and COMP-B.")

        # 4. Run Core Auto-Enrollment (Zero Manual Effort for Core!)
        print("[*] 3. Running Automatic Core Course Enrollment for Semester 5...")
        engine = AllotmentEngine(db)
        core_summary = await engine.auto_enroll_core_for_term(academic_term)
        print(f"  [OK] Auto-Enrolled Core Courses: {core_summary['total_enrollments_created']} student enrollments created!")

        # 5. Generate Realistic Google Form PEC Elective Choice CSV
        print("[*] 4. Generating Realistic Google Form Electives CSV...")
        pec_theory_options = [
            ("25PEC13CE11", "Blockchain Technology"),
            ("25PEC13CE12", "Deep Learning and Reinforcement Learning"),
            ("25PEC13CE13", "Cyber Security"),
            ("25PEC13CE14", "Big Data Analytics"),
        ]

        pecl_lab_options = [
            ("25PECL13CE15", "Ethical Hacking Laboratory"),
            ("25PECL13CE12", "Natural Language Processing Laboratory"),
            ("25PECL13CE11", "Image Processing Laboratory"),
            ("25PECL13CE13", "Industrial IoT Laboratory"),
        ]

        csv_rows = []
        all_comp_students = students_a + students_b

        # Distribute students across elective options realistically
        for idx, st in enumerate(all_comp_students):
            # Deterministic group: 0, 1, 2, 3
            group = idx % 4
            theory_code, theory_name = pec_theory_options[group]
            lab_code, lab_name = pecl_lab_options[group]

            div_name = "COMP-A" if st.division_id == div_a.id else "COMP-B"

            # Row for PEC Theory elective
            csv_rows.append({
                "student_id": st.student_erp_id,
                "roll_no": st.roll_no,
                "student_name": st.full_name,
                "department": "Computer",
                "class_div": div_name,
                "course_code": theory_code,
                "course_name": theory_name,
                "elective_type": "PEC-1 Theory",
                "academic_term": academic_term
            })

            # Row for PECL Lab elective
            csv_rows.append({
                "student_id": st.student_erp_id,
                "roll_no": st.roll_no,
                "student_name": st.full_name,
                "department": "Computer",
                "class_div": div_name,
                "course_code": lab_code,
                "course_name": lab_name,
                "elective_type": "PECL-1 Lab",
                "academic_term": academic_term
            })

        df_allotment = pd.DataFrame(csv_rows)

        # Save standard allotment CSV & Excel in root directory
        csv_path = os.path.normpath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "sample_google_form_pec_allotment.csv"))
        xlsx_path = os.path.normpath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "sample_google_form_pec_allotment.xlsx"))

        # Save standard ingestion format expected by engine
        engine_df = df_allotment[["student_id", "roll_no", "department", "class_div", "course_code", "academic_term"]]
        engine_df.to_csv(csv_path, index=False)
        engine_df.to_excel(xlsx_path, index=False)
        print(f"  [OK] Saved Electives CSV: {csv_path} ({len(engine_df)} rows)")
        print(f"  [OK] Saved Electives Excel: {xlsx_path}")

        # 6. Ingest Elective CSV via Allotment Engine
        print("[*] 5. Ingesting Elective Choices via Allotment Engine...")
        with open(xlsx_path, "rb") as f:
            file_bytes = f.read()
        allot_summary = await engine.process_file(file_bytes, "sample_google_form_pec_allotment.xlsx")
        print(f"  [OK] Processed {allot_summary['total_rows_processed']} elective choices into balanced batches!")

        # 7. Faculty Allocation (Both Auto & Manual)
        print("[*] 6. Allocating Faculty to Division Theory Sections & Lab Batches...")
        vance = faculty_users["faculty@academic.edu"]
        anita = faculty_users["anita.kulkarni@academic.edu"]
        iyer = faculty_users["rajesh.iyer@academic.edu"]
        sneha = faculty_users["sneha.deshmukh@academic.edu"]
        vikram = faculty_users["vikram.malhotra@academic.edu"]
        priya = faculty_users["priya.sharma@academic.edu"]
        arjun = faculty_users["arjun.nair@academic.edu"]

        # Fetch offerings for the term
        off_res = await db.execute(
            select(CourseOffering)
            .where(CourseOffering.academic_term == academic_term)
            .options(
                selectinload(CourseOffering.course),
                selectinload(CourseOffering.sections),
                selectinload(CourseOffering.batches)
            )
        )
        offerings = off_res.scalars().all()

        for off in offerings:
            code = off.course.code
            # Cryptography (25PCC13CE19)
            if code == "25PCC13CE19":
                for sec in off.sections:
                    if "A" in sec.section_name:
                        sec.faculty_id = vance.id
                    else:
                        sec.faculty_id = priya.id
                for b in off.batches:
                    if "A-B1" in b.batch_name:
                        b.faculty_id = vance.id
                    elif "A-B2" in b.batch_name:
                        b.faculty_id = priya.id
                    else:
                        b.faculty_id = vikram.id

            # Theory of Computer Science (25PCC13CE21)
            elif code == "25PCC13CE21":
                for sec in off.sections:
                    sec.faculty_id = anita.id
                for b in off.batches:
                    b.faculty_id = anita.id

            # Computer Networks (25PCC13CE22)
            elif code == "25PCC13CE22":
                for sec in off.sections:
                    sec.faculty_id = iyer.id
                for b in off.batches:
                    b.faculty_id = iyer.id

            # Data Warehousing (25PCC13CE14)
            elif code == "25PCC13CE14":
                for sec in off.sections:
                    sec.faculty_id = sneha.id
                for b in off.batches:
                    b.faculty_id = sneha.id

            # Cloud Computing Lab (25VSE13CE04)
            elif code == "25VSE13CE04":
                for b in off.batches:
                    if "A-B1" in b.batch_name:
                        b.faculty_id = vance.id
                    else:
                        b.faculty_id = vikram.id

            # Blockchain (25PEC13CE11)
            elif code == "25PEC13CE11":
                for sec in off.sections:
                    sec.faculty_id = vance.id
                for b in off.batches:
                    b.faculty_id = vance.id

            # Deep Learning (25PEC13CE12)
            elif code == "25PEC13CE12":
                for sec in off.sections:
                    sec.faculty_id = arjun.id
                for b in off.batches:
                    b.faculty_id = arjun.id

            # Cyber Security (25PEC13CE13)
            elif code == "25PEC13CE13":
                for sec in off.sections:
                    sec.faculty_id = priya.id
                for b in off.batches:
                    b.faculty_id = priya.id

            # Big Data Analytics (25PEC13CE14)
            elif code == "25PEC13CE14":
                for sec in off.sections:
                    sec.faculty_id = sneha.id
                for b in off.batches:
                    b.faculty_id = sneha.id

        await db.flush()
        print("  [OK] Faculty members successfully assigned to Theory Sections & Lab Batches!")

        # 8. Normalize Attendance Logs Strictly for Enrolled Subjects
        print("[*] 7. Normalizing Attendance Logs strictly based on active enrollments...")
        # Clear old attendance logs for COMP students
        comp_student_ids = [s.id for s in all_comp_students]
        await db.execute(delete(AttendanceLog).where(AttendanceLog.student_id.in_(comp_student_ids)))

        # Fetch all enrollments for COMP students in this term
        enr_stmt = (
            select(StudentEnrollment)
            .join(CourseOffering)
            .where(
                StudentEnrollment.student_id.in_(comp_student_ids),
                CourseOffering.academic_term == academic_term
            )
            .options(
                selectinload(StudentEnrollment.offering).selectinload(CourseOffering.course)
            )
        )
        enr_res = await db.execute(enr_stmt)
        enrollments = enr_res.scalars().all()

        enr_by_student = {}
        for enr in enrollments:
            enr_by_student.setdefault(enr.student_id, []).append(enr)

        attendance_rows = []
        for st in all_comp_students:
            st_enrs = enr_by_student.get(st.id, [])
            is_alex = st.email == "student@academic.edu"
            is_rahul = st.email == "atrisk.student@academic.edu"

            for enr in st_enrs:
                c = enr.offering.course
                total_cls = random.randint(25, 30)

                if is_alex:
                    pct = random.uniform(0.85, 0.95)
                elif is_rahul:
                    pct = random.uniform(0.68, 0.74)
                else:
                    pct = random.uniform(0.72, 0.92)

                attended = int(round(total_cls * pct))
                attendance_rows.append(AttendanceLog(
                    student_id=st.id,
                    course_id=c.id,
                    subject=f"{c.name} ({c.code})",
                    total_classes=total_cls,
                    attended_classes=attended
                ))

        db.add_all(attendance_rows)
        await db.commit()
        print(f"  [OK] Created {len(attendance_rows)} Attendance records strictly matching student enrollments (0 Sem-6 leaks)!")

    print("\n" + "=" * 80)
    print("ALL DONE: Clean, production-grade academic ecosystem initialized successfully!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_clean_setup())
