import asyncio
import os
import sys
import uuid
import random

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal, sync_engine, Base
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
    FacultyCourseDivision,
)
from app.core.security import hash_password

ACADEMIC_TERM = "2026-27-SEM5"

# Realistic names for 70 students in COMP-A
FIRST_NAMES_A = [
    "Alex", "Jayden", "Pooja", "Ella", "Xiu", "Michael", "Sophia", "Daniel", "Ananya", "Liam",
    "Emma", "Ethan", "Olivia", "Noah", "Ava", "Lucas", "Mia", "Mason", "Isabella", "Oliver",
    "Aria", "Elijah", "Chloe", "Aiden", "Harper", "James", "Amelia", "Benjamin", "Evelyn", "Alexander",
    "Abigail", "Henry", "Emily", "Sebastian", "Elizabeth", "Jack", "Mila", "William", "Ella", "Samuel",
    "Avery", "David", "Scarlett", "Joseph", "Grace", "Matthew", "Lily", "Jackson", "Zoey", "Levi",
    "Hannah", "Mateo", "Lillian", "Owen", "Addison", "John", "Aubrey", "Wyatt", "Ellie", "Luke",
    "Stella", "Asher", "Natalie", "Carter", "Zoe", "Julian", "Leah", "Grayson", "Hazel", "Leo"
]

LAST_NAMES_A = [
    "Mercer", "Lee", "Martinez", "Gupta", "Wong", "Smith", "Johnson", "Brown", "Patel", "Jones",
    "Garcia", "Miller", "Davis", "Rodriguez", "Shah", "Wilson", "Anderson", "Thomas", "Taylor", "Moore",
    "Jackson", "Martin", "Kulkarni", "Deshmukh", "Joshi", "Iyer", "Nair", "Verma", "Rao", "Reddy",
    "Kapoor", "Bhatia", "Malhotra", "Chopra", "Khanna", "Mehta", "Sen", "Roy", "Bose", "Dutta",
    "Banerjee", "Das", "Mukherjee", "Chatterjee", "Ghosh", "Sengupta", "Choudhury", "Bhattacharya", "Chakraborty", "Saha",
    "Mishra", "Pandey", "Trivedi", "Pathak", "Dubey", "Tiwari", "Shukla", "Tripathi", "Dwivedi", "Chaturvedi",
    "Natarajan", "Subramanian", "Ranganathan", "Venkatesh", "Krishnan", "Balasubramanian", "Sundaram", "Swaminathan", "Ramachandran", "Srinivasan"
]

# Realistic names for 70 students in COMP-B
FIRST_NAMES_B = [
    "Aarav", "Diya", "Rohan", "Ananya", "Kabir", "Ishaan", "Tanvi", "Aditya", "Meera", "Arjun",
    "Rhea", "Vivaan", "Saanvi", "Reyansh", "Anika", "Ayaan", "Tara", "Kavya", "Vihaan", "Samaira",
    "Shaurya", "Myra", "Atharv", "Prisha", "Advait", "Siya", "Dhruv", "Anvi", "Dev", "Ira",
    "Samar", "Sara", "Kian", "Navya", "Rudra", "Kyra", "Arnav", "Avani", "Parth", "Ahana",
    "Aarush", "Arya", "Darsh", "Riddhi", "Hridaan", "Nisha", "Yuvan", "Pari", "Neil", "Anaya",
    "Madhav", "Kashvi", "Tanay", "Mishti", "Raghav", "Veda", "Harsh", "Mira", "Ayush", "Sanvi",
    "Pranav", "Zoya", "Kunal", "Tia", "Nirvaan", "Ruhi", "Shlok", "Isha", "Manan", "Kiara"
]

LAST_NAMES_B = [
    "Patel", "Sen", "Desai", "Roy", "Mehta", "Nair", "Kulkarni", "Joshi", "Iyer", "Verma",
    "Shah", "Sharma", "Bhatia", "Malhotra", "Chopra", "Khanna", "Kapoor", "Dubey", "Tiwari", "Pandey",
    "Mishra", "Trivedi", "Pathak", "Shukla", "Tripathi", "Dwivedi", "Chaturvedi", "Banerjee", "Chatterjee", "Mukherjee",
    "Ghosh", "Bose", "Dutta", "Das", "Saha", "Bhattacharya", "Chakraborty", "Sengupta", "Rao", "Reddy",
    "Natarajan", "Subramanian", "Krishnan", "Sundaram", "Swaminathan", "Balasubramanian", "Venkatesh", "Ramachandran", "Srinivasan", "Ranganathan",
    "Fernandes", "D'Souza", "Pereira", "Rodrigues", "Gonsalves", "Lobo", "Almeida", "Pinto", "Cardozo", "Sequeira",
    "Vance", "Sterling", "Holloway", "Blackwood", "Sinclair", "Vanderbilt", "Hastings", "Montgomery", "Kensington", "Lancaster"
]

FACULTY_PROFILES = [
    {"name": "Prof. Anita Kulkarni", "email": "anita.kulkarni@academic.edu"},
    {"name": "Prof. Rajesh Iyer", "email": "rajesh.iyer@academic.edu"},
    {"name": "Prof. Sneha Deshmukh", "email": "sneha.deshmukh@academic.edu"},
    {"name": "Prof. Vikram Malhotra", "email": "vikram.malhotra@academic.edu"},
    {"name": "Prof. Priya Sharma", "email": "priya.sharma@academic.edu"},
    {"name": "Prof. Arjun Nair", "email": "arjun.nair@academic.edu"},
    {"name": "Prof. David Vance", "email": "faculty@academic.edu"},
]

# The 5 Core Semester 5 Courses for Computer Engineering (Strictly COMPS)
CORE_COURSES = [
    {
        "code": "25PCC13CE14",
        "name": "Data Warehousing and Mining",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 3,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "anita.kulkarni@academic.edu",
        "theory_fac_b": "anita.kulkarni@academic.edu",
        "lab_fac_a": ["anita.kulkarni@academic.edu", "anita.kulkarni@academic.edu", "sneha.deshmukh@academic.edu", "sneha.deshmukh@academic.edu"],
        "lab_fac_b": ["anita.kulkarni@academic.edu", "anita.kulkarni@academic.edu", "sneha.deshmukh@academic.edu", "sneha.deshmukh@academic.edu"],
    },
    {
        "code": "25PCC13CE19",
        "name": "Cryptography and System Security",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 3,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "rajesh.iyer@academic.edu",
        "theory_fac_b": "rajesh.iyer@academic.edu",
        "lab_fac_a": ["rajesh.iyer@academic.edu", "rajesh.iyer@academic.edu", "rajesh.iyer@academic.edu", "rajesh.iyer@academic.edu"],
        "lab_fac_b": ["rajesh.iyer@academic.edu", "rajesh.iyer@academic.edu", "rajesh.iyer@academic.edu", "rajesh.iyer@academic.edu"],
    },
    {
        "code": "25PCC13CE21",
        "name": "Theory of Computer Science",
        "delivery_mode": "THEORY_TUTORIAL",
        "th_hours": 3,
        "pr_hours": 0,
        "tu_hours": 1,
        "theory_fac_a": "vikram.malhotra@academic.edu",
        "theory_fac_b": "sneha.deshmukh@academic.edu",
        "lab_fac_a": ["vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu"],
        "lab_fac_b": ["sneha.deshmukh@academic.edu", "sneha.deshmukh@academic.edu", "sneha.deshmukh@academic.edu", "sneha.deshmukh@academic.edu"],
    },
    {
        "code": "25PCC13CE22",
        "name": "Computer Networks",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 3,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "faculty@academic.edu",
        "theory_fac_b": "priya.sharma@academic.edu",
        "lab_fac_a": ["faculty@academic.edu", "faculty@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu"],
        "lab_fac_b": ["priya.sharma@academic.edu", "priya.sharma@academic.edu", "priya.sharma@academic.edu", "priya.sharma@academic.edu"],
    },
    {
        "code": "25VSE13CE04",
        "name": "Cloud Computing Laboratory",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": None,
        "theory_fac_b": None,
        "lab_fac_a": ["arjun.nair@academic.edu", "arjun.nair@academic.edu", "arjun.nair@academic.edu", "arjun.nair@academic.edu"],
        "lab_fac_b": ["priya.sharma@academic.edu", "priya.sharma@academic.edu", "priya.sharma@academic.edu", "priya.sharma@academic.edu"],
    },
]

ELECTIVE_COURSES = [
    {"code": "25PEC13CE11", "name": "Blockchain Technology", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 3, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PEC13CE12", "name": "Deep Learning and Reinforcement Learning", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 3, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PEC13CE13", "name": "Cyber Security", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 3, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PEC13CE14", "name": "Big Data Analytics", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 3, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PECL13CE11", "name": "Image Processing Laboratory", "delivery_mode": "PRACTICAL_ONLY", "th_hours": 0, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PECL13CE12", "name": "Natural Language Processing Laboratory", "delivery_mode": "PRACTICAL_ONLY", "th_hours": 0, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PECL13CE13", "name": "Industrial IoT Laboratory", "delivery_mode": "PRACTICAL_ONLY", "th_hours": 0, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
    {"code": "25PECL13CE15", "name": "Ethical Hacking Laboratory", "delivery_mode": "PRACTICAL_ONLY", "th_hours": 0, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT"},
]


async def seed_database():
    """
    Primary Database Seeder for Smart Academic Platform.
    Seeds exclusively Computer Engineering (COMPS) department:
      - Division COMP-A: Exactly 70 students (Roll 1-70, Batches B1-B4)
      - Division COMP-B: Exactly 70 students (Roll 1-70, Batches B1-B4)
      - Total 140 students
      - 5 Core Courses auto-enrolled with realistic attendance (85-96%)
      - 8 Electives offered (4 PEC + 4 PECL)
      - Demo Student Alex Mercer (student@academic.edu) has chosen PEC (7 subjects)
      - All other 139 students have exactly 5 core subjects
      - Faculty assignments for all theory sections and practical batches
    """
    print("[*] Ensuring database tables exist...")
    Base.metadata.create_all(bind=sync_engine)

    pw_hash_student = hash_password("student123")
    pw_hash_faculty = hash_password("faculty123")
    pw_hash_admin = hash_password("admin123")

    async with AsyncSessionLocal() as db:
        print("[*] Starting COMPS department seeding...")

        # -------------------------------------------------------------
        # 1. Clean out non-COMP departments & unwanted courses
        # -------------------------------------------------------------
        await db.execute(delete(Department).where(Department.code != "COMP"))

        res = await db.execute(select(Department).where(Department.code == "COMP"))
        dept_comp = res.scalar_one_or_none()
        if not dept_comp:
            dept_comp = Department(id=uuid.uuid4(), code="COMP", name="Computer Engineering")
            db.add(dept_comp)
            await db.flush()

        # Delete all existing student accounts and old allotments
        await db.execute(delete(User).where(User.role == "STUDENT"))
        await db.execute(delete(StudentEnrollment))
        await db.execute(delete(AttendanceLog))
        await db.execute(delete(ClassSection))
        await db.execute(delete(PracticalBatch))
        await db.execute(delete(CourseOffering))
        await db.execute(delete(FacultyCourseDivision))
        await db.flush()

        # Clean any unwanted courses not in COMPS core or electives
        all_allowed_codes = {c["code"] for c in CORE_COURSES} | {el["code"] for el in ELECTIVE_COURSES}
        await db.execute(delete(Course).where(~Course.code.in_(all_allowed_codes)))
        await db.flush()

        # -------------------------------------------------------------
        # 2. Setup Divisions: COMP-A (70) and COMP-B (70)
        # -------------------------------------------------------------
        await db.execute(delete(Division).where(Division.department_id == dept_comp.id))
        await db.flush()

        div_a = Division(
            id=uuid.uuid4(),
            department_id=dept_comp.id,
            name="A",
            semester=5,
            student_count=70
        )
        div_b = Division(
            id=uuid.uuid4(),
            department_id=dept_comp.id,
            name="B",
            semester=5,
            student_count=70
        )
        db.add_all([div_a, div_b])
        await db.flush()
        print(f"[*] Created Divisions: COMP-A ({div_a.id}) & COMP-B ({div_b.id})")

        # -------------------------------------------------------------
        # 3. Setup Faculty Members & Admin
        # -------------------------------------------------------------
        faculty_map = {}
        for f_data in FACULTY_PROFILES:
            res = await db.execute(select(User).where(User.email == f_data["email"]))
            fac_user = res.scalar_one_or_none()
            if not fac_user:
                fac_user = User(
                    id=uuid.uuid4(),
                    email=f_data["email"],
                    hashed_password=pw_hash_faculty,
                    full_name=f_data["name"],
                    role="FACULTY",
                    department_id=dept_comp.id,
                )
                db.add(fac_user)
                await db.flush()
            else:
                fac_user.department_id = dept_comp.id
            faculty_map[f_data["email"]] = fac_user

        res = await db.execute(select(User).where(User.email == "admin@academic.edu"))
        admin_user = res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email="admin@academic.edu",
                hashed_password=pw_hash_admin,
                full_name="Academic Administrator",
                role="ADMIN",
                department_id=dept_comp.id,
            )
            db.add(admin_user)
            await db.flush()

        # -------------------------------------------------------------
        # 4. Create EXACTLY 70 Students in COMP-A and 70 in COMP-B
        # -------------------------------------------------------------
        students_a = []
        students_b = []

        # COMP-A: 70 Students
        for i in range(1, 71):
            if i == 1:
                name = "Alex Mercer"
                email = "student@academic.edu"
            else:
                first = FIRST_NAMES_A[(i - 1) % len(FIRST_NAMES_A)]
                last = LAST_NAMES_A[(i - 1) % len(LAST_NAMES_A)]
                name = f"{first} {last}"
                email = f"student.a.{i:02d}@comp.academic.edu"

            # Batch distribution: B1 (1-18), B2 (19-35), B3 (36-53), B4 (54-70)
            if i <= 18:
                batch_key = "B1"
            elif i <= 35:
                batch_key = "B2"
            elif i <= 53:
                batch_key = "B3"
            else:
                batch_key = "B4"

            u = User(
                id=uuid.uuid4(),
                email=email,
                hashed_password=pw_hash_student,
                full_name=name,
                role="STUDENT",
                student_erp_id=f"COMP2024A{i:03d}",
                roll_no=f"COMP-A-{i:02d}",
                department_id=dept_comp.id,
                division_id=div_a.id,
            )
            db.add(u)
            students_a.append((u, batch_key, i))

        # COMP-B: 70 Students
        for i in range(1, 71):
            first = FIRST_NAMES_B[(i - 1) % len(FIRST_NAMES_B)]
            last = LAST_NAMES_B[(i - 1) % len(LAST_NAMES_B)]
            name = f"{first} {last}"
            email = f"student.b.{i:02d}@comp.academic.edu"

            if i <= 18:
                batch_key = "B1"
            elif i <= 35:
                batch_key = "B2"
            elif i <= 53:
                batch_key = "B3"
            else:
                batch_key = "B4"

            u = User(
                id=uuid.uuid4(),
                email=email,
                hashed_password=pw_hash_student,
                full_name=name,
                role="STUDENT",
                student_erp_id=f"COMP2024B{i:03d}",
                roll_no=f"COMP-B-{i:02d}",
                department_id=dept_comp.id,
                division_id=div_b.id,
            )
            db.add(u)
            students_b.append((u, batch_key, i))

        await db.flush()
        print(f"[*] Seeded {len(students_a)} students in COMP-A and {len(students_b)} students in COMP-B (Total: 140)")

        # -------------------------------------------------------------
        # 5. Create Core Course Offerings, Sections, and Batches
        # -------------------------------------------------------------
        core_offering_map = {}
        batch_objects_a = {}
        batch_objects_b = {}
        section_objects_a = {}
        section_objects_b = {}

        for c_data in CORE_COURSES:
            res = await db.execute(select(Course).where(Course.code == c_data["code"]))
            course = res.scalar_one_or_none()
            if not course:
                course = Course(
                    id=uuid.uuid4(),
                    code=c_data["code"],
                    name=c_data["name"],
                    department_id=dept_comp.id,
                    semester=5,
                    course_tier="CLASS",
                    delivery_mode=c_data["delivery_mode"],
                    th_hours=c_data["th_hours"],
                    pr_hours=c_data["pr_hours"],
                    tu_hours=c_data["tu_hours"],
                )
                db.add(course)
                await db.flush()
            else:
                course.department_id = dept_comp.id
                course.delivery_mode = c_data["delivery_mode"]
                course.course_tier = "CLASS"

            off = CourseOffering(
                id=uuid.uuid4(),
                course_id=course.id,
                academic_term=ACADEMIC_TERM
            )
            db.add(off)
            await db.flush()
            core_offering_map[c_data["code"]] = off
            batch_objects_a[c_data["code"]] = {}
            batch_objects_b[c_data["code"]] = {}

            # Sections for COMP-A and COMP-B (if theory component exists)
            sec_a = None
            sec_b = None
            if c_data["delivery_mode"] != "PRACTICAL_ONLY":
                fac_a = faculty_map.get(c_data["theory_fac_a"])
                fac_b = faculty_map.get(c_data["theory_fac_b"])
                sec_a = ClassSection(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_name="COMP-A-Theory",
                    faculty_id=fac_a.id if fac_a else None,
                )
                sec_b = ClassSection(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_name="COMP-B-Theory",
                    faculty_id=fac_b.id if fac_b else None,
                )
                db.add_all([sec_a, sec_b])
                await db.flush()
                section_objects_a[c_data["code"]] = sec_a
                section_objects_b[c_data["code"]] = sec_b

            # 4 Practical Batches for COMP-A (B1, B2, B3, B4)
            for idx, b_name in enumerate(["B1", "B2", "B3", "B4"]):
                fac_email = c_data["lab_fac_a"][idx] if idx < len(c_data["lab_fac_a"]) else None
                fac_obj = faculty_map.get(fac_email) if fac_email else None
                b_obj = PracticalBatch(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_id=sec_a.id if sec_a else None,
                    batch_name=f"COMP-A-{b_name}",
                    faculty_id=fac_obj.id if fac_obj else None,
                )
                db.add(b_obj)
                batch_objects_a[c_data["code"]][b_name] = b_obj

            # 4 Practical Batches for COMP-B (B1, B2, B3, B4)
            for idx, b_name in enumerate(["B1", "B2", "B3", "B4"]):
                fac_email = c_data["lab_fac_b"][idx] if idx < len(c_data["lab_fac_b"]) else None
                fac_obj = faculty_map.get(fac_email) if fac_email else None
                b_obj = PracticalBatch(
                    id=uuid.uuid4(),
                    offering_id=off.id,
                    section_id=sec_b.id if sec_b else None,
                    batch_name=f"COMP-B-{b_name}",
                    faculty_id=fac_obj.id if fac_obj else None,
                )
                db.add(b_obj)
                batch_objects_b[c_data["code"]][b_name] = b_obj

            await db.flush()

        print("[*] Created 5 Core Course Offerings with theory sections and 4 lab batches each for COMP-A & COMP-B.")

        # -------------------------------------------------------------
        # 6. Create Elective Offerings
        # -------------------------------------------------------------
        elective_offerings = {}
        for el in ELECTIVE_COURSES:
            res = await db.execute(select(Course).where(Course.code == el["code"]))
            c_el = res.scalar_one_or_none()
            if not c_el:
                c_el = Course(
                    id=uuid.uuid4(),
                    code=el["code"],
                    name=el["name"],
                    department_id=dept_comp.id,
                    semester=5,
                    course_tier=el["tier"],
                    delivery_mode=el["delivery_mode"],
                    th_hours=el["th_hours"],
                    pr_hours=el["pr_hours"],
                    tu_hours=el["tu_hours"],
                )
                db.add(c_el)
                await db.flush()
            else:
                c_el.department_id = dept_comp.id
                c_el.course_tier = el["tier"]
                c_el.delivery_mode = el["delivery_mode"]

            off_el = CourseOffering(
                id=uuid.uuid4(),
                course_id=c_el.id,
                academic_term=ACADEMIC_TERM
            )
            db.add(off_el)
            await db.flush()
            elective_offerings[el["code"]] = (off_el, c_el)

        print(f"[*] Created {len(elective_offerings)} Elective Course Offerings.")

        # -------------------------------------------------------------
        # 7. Auto-Enroll all 140 Students into the 5 Core Subjects
        # -------------------------------------------------------------
        all_students = students_a + students_b
        enrollment_count = 0
        log_count = 0

        for student_user, batch_key, roll in all_students:
            is_div_a = student_user.division_id == div_a.id
            target_batches = batch_objects_a if is_div_a else batch_objects_b
            target_sections = section_objects_a if is_div_a else section_objects_b

            for c_data in CORE_COURSES:
                code = c_data["code"]
                off = core_offering_map[code]
                sec = target_sections.get(code)
                batch = target_batches[code][batch_key]

                enr = StudentEnrollment(
                    id=uuid.uuid4(),
                    student_id=student_user.id,
                    offering_id=off.id,
                    section_id=sec.id if sec else None,
                    batch_id=batch.id if batch else None,
                )
                db.add(enr)
                enrollment_count += 1

                total_classes = 28
                if student_user.email == "student@academic.edu":
                    attended = 26
                else:
                    attended = random.randint(23, 27)

                log = AttendanceLog(
                    id=uuid.uuid4(),
                    student_id=student_user.id,
                    course_id=off.course_id,
                    subject=f"{c_data['name']} ({code})",
                    total_classes=total_classes,
                    attended_classes=attended,
                )
                db.add(log)
                log_count += 1

        # -------------------------------------------------------------
        # 8. For Alex Mercer (student@academic.edu), add the chosen PEC
        # -------------------------------------------------------------
        alex_user = students_a[0][0]
        # Alex has elected 25PEC13CE11 (Blockchain Technology) & 25PECL13CE15 (Ethical Hacking Lab)
        for pec_code in ["25PEC13CE11", "25PECL13CE15"]:
            off_pec, c_pec = elective_offerings[pec_code]
            enr_pec = StudentEnrollment(
                id=uuid.uuid4(),
                student_id=alex_user.id,
                offering_id=off_pec.id,
                section_id=None,
                batch_id=None,
            )
            db.add(enr_pec)
            enrollment_count += 1

            log_pec = AttendanceLog(
                id=uuid.uuid4(),
                student_id=alex_user.id,
                course_id=off_pec.course_id,
                subject=f"{c_pec.name} ({pec_code})",
                total_classes=27,
                attended_classes=25,
            )
            db.add(log_pec)
            log_count += 1

        await db.commit()
        print("\n" + "=" * 70)
        print("[SUCCESS] COMPS ECOSYSTEM SEEDED SUCCESSFULLY:")
        print(f"  - Division COMP-A: Exactly 70 students (Roll 1-70, Batches B1-B4)")
        print(f"  - Division COMP-B: Exactly 70 students (Roll 1-70, Batches B1-B4)")
        print(f"  - Total Students: 140")
        print(f"  - Core Offerings: 5 (Enrolled by all 140 students)")
        print(f"  - Elective Offerings: 8 (4 PEC + 4 PECL)")
        print(f"  - Total Student Enrollments: {enrollment_count}")
        print(f"  - Total Attendance Logs: {log_count}")
        print(f"  - Alex Mercer (student@academic.edu): 7 subjects (5 Core + 2 PEC/PECL)")
        print(f"  - All other 139 students: Exactly 5 subjects (until electives chosen)")
        print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(seed_database())
