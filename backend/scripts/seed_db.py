import asyncio
import os
import sys
import uuid
import random

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")), override=True)
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env")), override=True)

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

TERM_SEM5 = "2026-27-SEM5"  # July - December 2026 (Ongoing)
TERM_SEM6 = "2026-27-SEM6"  # January - June 2027 (Upcoming)

# ---------------------------------------------------------------------------
# EXACTLY 22 COLLEGE FACULTY PROFILES (Computer Engineering Department)
# From: https://docs.google.com/spreadsheets/d/1fTBdcpQP_3vJ_BZI5yS36z0KGQOVOgWmRvqXqPw19nc/edit?usp=sharing
# ---------------------------------------------------------------------------
FACULTY_PROFILES = [
    {"name": "Dr. Sujata Deshmukh", "email": "sujata.deshmukh@academic.edu"},
    {"name": "Prof. Merly Thomas", "email": "merly.thomas@academic.edu"},
    {"name": "Dr. Monica Khanore", "email": "monica.khanore@academic.edu"},
    {"name": "Dr. Ashok Kanthe", "email": "ashok.kanthe@academic.edu"},
    {"name": "Dr. Roshni Padate", "email": "roshni.padate@academic.edu"},
    {"name": "Dr. Smita Ambarkar", "email": "smita.ambarkar@academic.edu"},
    {"name": "Dr. Kalpana Deorukhkar", "email": "kalpana.deorukhkar@academic.edu"},
    {"name": "Prof. Ashwini Pansare", "email": "ashwini.pansare@academic.edu"},
    {"name": "Dr. Supriya Kamoji", "email": "supriya.kamoji@academic.edu"},
    {"name": "Prof. Sushma Nagdeote", "email": "sushma.nagdeote@academic.edu"},
    {"name": "Dr. Monali Shetty", "email": "monali.shetty@academic.edu"},
    {"name": "Prof. Sangeeta Parshionikar", "email": "sangeeta.parshionikar@academic.edu"},
    {"name": "Prof. Lokhande Unik", "email": "unik.lokhande@academic.edu"},
    {"name": "Prof. Ankita Amburle", "email": "ankita.amburle@academic.edu"},
    {"name": "Dr. Vijay Shelake", "email": "vijay.shelake@academic.edu"},
    {"name": "Prof. Nirajsingh R Yeotikar", "email": "nirajsingh.yeotikar@academic.edu"},
    {"name": "Prof. Prity Bansode", "email": "prity.bansode@academic.edu"},
    {"name": "Prof. Khushboo Singh", "email": "khushboo.singh@academic.edu"},
    {"name": "Prof. Garima Singh", "email": "garima.singh@academic.edu"},
    {"name": "Prof. Varsha Phulpagar", "email": "varsha.phulpagar@academic.edu"},
    {"name": "Prof. Akshata Satyawan Patil", "email": "akshata.patil@academic.edu"},
    {"name": "Prof. Kranti Kiran Wagle", "email": "kranti.wagle@academic.edu"},
    {"name": "Dr. Sujata Deshmukh", "email": "faculty@academic.edu"},
]

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

# ---------------------------------------------------------------------------
# SEMESTER V COURSES (FRCRCE-3-26 Scheme w.e.f. A.Y. 2026-27)
# ---------------------------------------------------------------------------
CORE_COURSES_SEM5 = [
    {
        "code": "25PCC13CE14",
        "name": "Data Warehousing and Mining",
        "tier": "CLASS",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "sushma.nagdeote@academic.edu",
        "theory_fac_b": "sujata.deshmukh@academic.edu",
        "lab_fac_a": ["sushma.nagdeote@academic.edu", "sushma.nagdeote@academic.edu", "prity.bansode@academic.edu", "prity.bansode@academic.edu"],
        "lab_fac_b": ["sujata.deshmukh@academic.edu", "sujata.deshmukh@academic.edu", "prity.bansode@academic.edu", "prity.bansode@academic.edu"],
    },
    {
        "code": "25PCC13CE22",
        "name": "Computer Networks",
        "tier": "CLASS",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "merly.thomas@academic.edu",
        "theory_fac_b": "ashok.kanthe@academic.edu",
        "lab_fac_a": ["merly.thomas@academic.edu", "merly.thomas@academic.edu", "khushboo.singh@academic.edu", "khushboo.singh@academic.edu"],
        "lab_fac_b": ["ashok.kanthe@academic.edu", "ashok.kanthe@academic.edu", "khushboo.singh@academic.edu", "khushboo.singh@academic.edu"],
    },
    {
        "code": "25PCC13CE19",
        "name": "Cryptography and System Security",
        "tier": "CLASS",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "monica.khanore@academic.edu",
        "theory_fac_b": "monali.shetty@academic.edu",
        "lab_fac_a": ["monica.khanore@academic.edu", "monica.khanore@academic.edu", "smita.ambarkar@academic.edu", "smita.ambarkar@academic.edu"],
        "lab_fac_b": ["monali.shetty@academic.edu", "monali.shetty@academic.edu", "smita.ambarkar@academic.edu", "smita.ambarkar@academic.edu"],
    },
    {
        "code": "25PCC13CE21",
        "name": "Theory of Computer Science",
        "tier": "CLASS",
        "delivery_mode": "THEORY_TUTORIAL",
        "th_hours": 2,
        "pr_hours": 0,
        "tu_hours": 1,
        "theory_fac_a": "kalpana.deorukhkar@academic.edu",
        "theory_fac_b": "ankita.amburle@academic.edu",
        "lab_fac_a": ["kalpana.deorukhkar@academic.edu"] * 4,
        "lab_fac_b": ["ankita.amburle@academic.edu"] * 4,
    },
    {
        "code": "25VSE13CE04",
        "name": "Cloud Computing Laboratory",
        "tier": "CLASS",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 4,
        "tu_hours": 0,
        "theory_fac_a": None,
        "theory_fac_b": None,
        "lab_fac_a": ["supriya.kamoji@academic.edu", "supriya.kamoji@academic.edu", "vijay.shelake@academic.edu", "vijay.shelake@academic.edu"],
        "lab_fac_b": ["unik.lokhande@academic.edu", "unik.lokhande@academic.edu", "vijay.shelake@academic.edu", "vijay.shelake@academic.edu"],
    },
]

ELECTIVE_COURSES_SEM5 = [
    # Department Electives - Theory (PEC)
    {
        "code": "25PEC13CE11",
        "name": "Blockchain Technology",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "ashok.kanthe@academic.edu",
    },
    {
        "code": "25PEC13CE12",
        "name": "Deep Learning and Reinforcement Learning",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "kalpana.deorukhkar@academic.edu",
    },
    {
        "code": "25PEC13CE13",
        "name": "Cyber Security",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "smita.ambarkar@academic.edu",
    },
    {
        "code": "25PEC13CE14",
        "name": "Big Data Analytics",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "ankita.amburle@academic.edu",
    },
    # Department Electives - Laboratory (PECL)
    {
        "code": "25PECL13CE11",
        "name": "Image Processing Laboratory",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "nirajsingh.yeotikar@academic.edu",
    },
    {
        "code": "25PECL13CE12",
        "name": "Natural Language Processing Laboratory",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "varsha.phulpagar@academic.edu",
    },
    {
        "code": "25PECL13CE15",
        "name": "Ethical Hacking Laboratory",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "unik.lokhande@academic.edu",
    },
    {
        "code": "25PECL13CE13",
        "name": "Industrial IoT Laboratory",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "tier": "DEPARTMENT",
        "faculty": "roshni.padate@academic.edu",
    },
    # Institute Open Electives (OE)
    {
        "code": "25OE13CE31",
        "name": "Health, Wellness and Psychology",
        "delivery_mode": "THEORY_ONLY",
        "th_hours": 2,
        "pr_hours": 0,
        "tu_hours": 0,
        "tier": "INSTITUTE",
        "faculty": "roshni.padate@academic.edu",
    },
    {
        "code": "25OE13CE32",
        "name": "Emotional and Spiritual Intelligence",
        "delivery_mode": "THEORY_ONLY",
        "th_hours": 2,
        "pr_hours": 0,
        "tu_hours": 0,
        "tier": "INSTITUTE",
        "faculty": "garima.singh@academic.edu",
    },
]

# ---------------------------------------------------------------------------
# SEMESTER VI COURSES (FRCRCE-3-26 Scheme w.e.f. A.Y. 2026-27)
# ---------------------------------------------------------------------------
CORE_COURSES_SEM6 = [
    {
        "code": "25PCC13CE15",
        "name": "Distributed Computing",
        "tier": "CLASS",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "anita.kulkarni@academic.edu",
        "theory_fac_b": "anita.kulkarni@academic.edu",
        "lab_fac_a": ["anita.kulkarni@academic.edu", "manoj.patil@academic.edu", "sachin.kulkarni@academic.edu", "sachin.kulkarni@academic.edu"],
        "lab_fac_b": ["anita.kulkarni@academic.edu", "manoj.patil@academic.edu", "sachin.kulkarni@academic.edu", "sachin.kulkarni@academic.edu"],
    },
    {
        "code": "25PCC13CE16",
        "name": "Software Engineering",
        "tier": "CLASS",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "faculty@academic.edu",
        "theory_fac_b": "priya.sharma@academic.edu",
        "lab_fac_a": ["faculty@academic.edu"] * 4,
        "lab_fac_b": ["priya.sharma@academic.edu"] * 4,
    },
    {
        "code": "25PCC13CE25",
        "name": "Advanced Microprocessors",
        "tier": "CLASS",
        "delivery_mode": "INTEGRATED_TH_PR",
        "th_hours": 2,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": "rajesh.iyer@academic.edu",
        "theory_fac_b": "rajesh.iyer@academic.edu",
        "lab_fac_a": ["rajesh.iyer@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu"],
        "lab_fac_b": ["rajesh.iyer@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu", "vikram.malhotra@academic.edu"],
    },
    {
        "code": "25PCC13CE17",
        "name": "Artificial Intelligence Laboratory",
        "tier": "CLASS",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": None,
        "theory_fac_b": None,
        "lab_fac_a": ["sunita.deshpande@academic.edu"] * 4,
        "lab_fac_b": ["neha.gupta@academic.edu"] * 4,
    },
    {
        "code": "25PCC13CE23",
        "name": "Mobile App Development",
        "tier": "CLASS",
        "delivery_mode": "PRACTICAL_ONLY",
        "th_hours": 0,
        "pr_hours": 2,
        "tu_hours": 0,
        "theory_fac_a": None,
        "theory_fac_b": None,
        "lab_fac_a": ["priya.sharma@academic.edu"] * 4,
        "lab_fac_b": ["arjun.nair@academic.edu"] * 4,
    },
]

ELECTIVE_COURSES_SEM6 = [
    # Department Electives (PEC / PECL)
    {"code": "25PEC13CE21", "name": "Decentralized Finance", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 2, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT", "faculty": "sunita.deshpande@academic.edu"},
    {"code": "25PEC13CE22", "name": "Generative AI", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 2, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT", "faculty": "manoj.patil@academic.edu"},
    {"code": "25PEC13CE23", "name": "Digital Forensics", "delivery_mode": "INTEGRATED_TH_PR", "th_hours": 2, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT", "faculty": "sachin.kulkarni@academic.edu"},
    {"code": "25PECL13CE21", "name": "Social Media Analytics Laboratory", "delivery_mode": "PRACTICAL_ONLY", "th_hours": 0, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT", "faculty": "pooja.rane@academic.edu"},
    {"code": "25PECL13CE25", "name": "Explainable AI Laboratory", "delivery_mode": "PRACTICAL_ONLY", "th_hours": 0, "pr_hours": 2, "tu_hours": 0, "tier": "DEPARTMENT", "faculty": "amit.verma@academic.edu"},
    # Institute Open Electives (OE)
    {"code": "25OE13CE41", "name": "Public Relations and Corporate Communication", "delivery_mode": "THEORY_ONLY", "th_hours": 2, "pr_hours": 0, "tu_hours": 0, "tier": "INSTITUTE", "faculty": "rahul.shah@academic.edu"},
]


async def seed_term(
    db: AsyncSession,
    academic_term: str,
    semester_num: int,
    core_courses_meta: list,
    elective_courses_meta: list,
    dept_comp: Department,
    div_a: Division,
    div_b: Division,
    faculty_map: dict,
    students_a: list,
    students_b: list,
):
    print(f"\n[*] --- Seeding {academic_term} (Semester {semester_num}) ---")
    core_offering_map = {}
    batch_objects_a = {}
    batch_objects_b = {}
    section_objects_a = {}
    section_objects_b = {}

    for c_data in core_courses_meta:
        res = await db.execute(select(Course).where(Course.code == c_data["code"]))
        course = res.scalar_one_or_none()
        if not course:
            course = Course(
                id=uuid.uuid4(),
                code=c_data["code"],
                name=c_data["name"],
                department_id=dept_comp.id,
                semester=semester_num,
                course_tier=c_data["tier"],
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
            course.course_tier = c_data["tier"]
            course.semester = semester_num

        off = CourseOffering(
            id=uuid.uuid4(),
            course_id=course.id,
            academic_term=academic_term,
        )
        db.add(off)
        await db.flush()
        core_offering_map[c_data["code"]] = off
        batch_objects_a[c_data["code"]] = {}
        batch_objects_b[c_data["code"]] = {}

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

        # Exactly 4 Practical Batches for COMP-A (B1: 18, B2: 18, B3: 17, B4: 17)
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

        # Exactly 4 Practical Batches for COMP-B (B1: 18, B2: 18, B3: 17, B4: 17)
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

    # Create Elective Offerings with assigned faculty, sections, and batches
    elective_offerings = {}
    for el in elective_courses_meta:
        res = await db.execute(select(Course).where(Course.code == el["code"]))
        c_el = res.scalar_one_or_none()
        if not c_el:
            c_el = Course(
                id=uuid.uuid4(),
                code=el["code"],
                name=el["name"],
                department_id=dept_comp.id,
                semester=semester_num,
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
            c_el.semester = semester_num

        off_el = CourseOffering(
            id=uuid.uuid4(),
            course_id=c_el.id,
            academic_term=academic_term,
        )
        db.add(off_el)
        await db.flush()

        fac_user = faculty_map.get(el.get("faculty"))
        sec_el = None
        if el["delivery_mode"] != "PRACTICAL_ONLY":
            sec_el = ClassSection(
                id=uuid.uuid4(),
                offering_id=off_el.id,
                section_name=f"{el['code']}-Sec1",
                faculty_id=fac_user.id if fac_user else None,
            )
            db.add(sec_el)
            await db.flush()

        batch_el = None
        if el["delivery_mode"] in ("INTEGRATED_TH_PR", "PRACTICAL_ONLY"):
            batch_el = PracticalBatch(
                id=uuid.uuid4(),
                offering_id=off_el.id,
                section_id=sec_el.id if sec_el else None,
                batch_name=f"{el['code']}-Lab1",
                faculty_id=fac_user.id if fac_user else None,
            )
            db.add(batch_el)
            await db.flush()

        elective_offerings[el["code"]] = (off_el, c_el, sec_el, batch_el)

    # Enroll Students into Core Courses
    all_students = students_a + students_b
    enr_count = 0
    for student_user, batch_key, roll in all_students:
        is_div_a = student_user.division_id == div_a.id
        target_batches = batch_objects_a if is_div_a else batch_objects_b
        target_sections = section_objects_a if is_div_a else section_objects_b

        for c_data in core_courses_meta:
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
            enr_count += 1

            # Attendance Logs ONLY for Ongoing Semester 5
            if academic_term == TERM_SEM5:
                total_classes = 28
                if student_user.email == "student@academic.edu":
                    attended = 26  # Good standing (~92.8%)
                elif student_user.email == "atrisk.student@academic.edu":
                    attended = 19  # At risk (<75% - 67.8%)
                else:
                    attended = random.randint(22, 27)

                log = AttendanceLog(
                    id=uuid.uuid4(),
                    student_id=student_user.id,
                    course_id=off.course_id,
                    subject=f"{c_data['name']} ({code})",
                    total_classes=total_classes,
                    attended_classes=attended,
                )
                db.add(log)

    # Enroll Students into Allocated Electives (PEC + PECL + OE)
    pec_codes = [c["code"] for c in elective_courses_meta if c["tier"] == "DEPARTMENT" and c["delivery_mode"] != "PRACTICAL_ONLY"]
    pecl_codes = [c["code"] for c in elective_courses_meta if c["tier"] == "DEPARTMENT" and c["delivery_mode"] == "PRACTICAL_ONLY"]
    oe_codes = [c["code"] for c in elective_courses_meta if c["tier"] == "INSTITUTE"]

    for idx, (student_user, batch_key, roll) in enumerate(all_students):
        # Demo student Alex Mercer (idx == 0): Blockchain + Image Processing Lab + Health Wellness
        if student_user.email == "student@academic.edu":
            chosen_pec = "25PEC13CE11"
            chosen_pecl = "25PECL13CE11"
            chosen_oe = "25OE13CE31"
        else:
            chosen_pec = pec_codes[idx % len(pec_codes)] if pec_codes else None
            chosen_pecl = pecl_codes[idx % len(pecl_codes)] if pecl_codes else None
            chosen_oe = oe_codes[idx % len(oe_codes)] if oe_codes else None

        for el_code in [chosen_pec, chosen_pecl, chosen_oe]:
            if el_code and el_code in elective_offerings:
                off_el, c_el, sec_el, batch_el = elective_offerings[el_code]
                enr_el = StudentEnrollment(
                    id=uuid.uuid4(),
                    student_id=student_user.id,
                    offering_id=off_el.id,
                    section_id=sec_el.id if sec_el else None,
                    batch_id=batch_el.id if batch_el else None,
                )
                db.add(enr_el)
                enr_count += 1

                # Attendance Logs ONLY for Ongoing Semester 5
                if academic_term == TERM_SEM5:
                    total_classes = 26
                    if student_user.email == "student@academic.edu":
                        attended = 24  # Good standing (~92.3%)
                    elif student_user.email == "atrisk.student@academic.edu":
                        attended = 17  # At risk (<75% - 65.4%)
                    else:
                        attended = random.randint(21, 25)

                    log_el = AttendanceLog(
                        id=uuid.uuid4(),
                        student_id=student_user.id,
                        course_id=off_el.course_id,
                        subject=f"{c_el.name} ({el_code})",
                        total_classes=total_classes,
                        attended_classes=attended,
                    )
                    db.add(log_el)

    await db.flush()
    print(f"[*] {academic_term}: Enrolled 140 students across 5 Core + Allocated Electives ({enr_count} total enrollments)")


async def seed_database():
    """
    Primary Database Seeder for Smart Academic Platform.
    Seeds exclusively:
      - 18 Computer Engineering Faculty Members
      - 70 Students in COMP-A (4 Batches: B1: 18, B2: 18, B3: 17, B4: 17)
      - 70 Students in COMP-B (4 Batches: B1: 18, B2: 18, B3: 17, B4: 17)
      - Total 140 Students
      - Semesters:
          * SEMESTER 5: July – December 2026 (2026-27-SEM5) [Ongoing]
          * SEMESTER 6: January – June 2027 (2026-27-SEM6) [Upcoming]
    """
    from app.core.config import settings
    db_target = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else settings.DATABASE_URL
    print("[*] Ensuring pgvector extension and database tables exist...")
    from sqlalchemy import text
    try:
        with sync_engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
    except Exception as e:
        print(f"[!] Warning creating vector extension (might already exist): {e}")

    Base.metadata.create_all(bind=sync_engine)

    pw_hash_student = hash_password("student123")
    pw_hash_faculty = hash_password("faculty123")
    pw_hash_admin = hash_password("admin123")

    async with AsyncSessionLocal() as db:
        print("[*] Resetting COMPS Department, Faculty, and Students...")

        await db.execute(delete(Department).where(Department.code != "COMP"))

        res = await db.execute(select(Department).where(Department.code == "COMP"))
        dept_comp = res.scalar_one_or_none()
        if not dept_comp:
            dept_comp = Department(id=uuid.uuid4(), code="COMP", name="Computer Engineering")
            db.add(dept_comp)
            await db.flush()

        # Delete all student accounts, old enrollments, logs, sections, batches, offerings, and old courses
        await db.execute(delete(User).where(User.role == "STUDENT"))
        allowed_emails = {f["email"] for f in FACULTY_PROFILES} | {"admin@academic.edu"}
        await db.execute(delete(User).where(~User.email.in_(allowed_emails)))
        await db.execute(delete(StudentEnrollment))
        await db.execute(delete(AttendanceLog))
        await db.execute(delete(ClassSection))
        await db.execute(delete(PracticalBatch))
        await db.execute(delete(CourseOffering))
        await db.execute(delete(FacultyCourseDivision))
        await db.execute(delete(Course))
        await db.flush()

        # Divisions: COMP-A (70) and COMP-B (70)
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

        # Setup EXACTLY 18 Faculty Profiles
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
                fac_user.full_name = f_data["name"]
            faculty_map[f_data["email"]] = fac_user

        print(f"[*] Configured {len(faculty_map)} Faculty Profiles in Computer Engineering.")

        # Admin user
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
        # Exactly 70 Students in COMP-A and 70 in COMP-B
        # Divided into EXACTLY 4 BATCHES:
        # B1 (1-18: 18 students), B2 (19-36: 18 students), B3 (37-53: 17 students), B4 (54-70: 17 students)
        # Total: 18 + 18 + 17 + 17 = 70 Students
        # -------------------------------------------------------------
        students_a = []
        students_b = []

        # COMP-A: 70 Students
        for i in range(1, 71):
            if i == 1:
                name = "Alex Mercer"
                email = "student@academic.edu"
            elif i == 2:
                name = "Jayden Lee"
                email = "atrisk.student@academic.edu"
            else:
                first = FIRST_NAMES_A[(i - 1) % len(FIRST_NAMES_A)]
                last = LAST_NAMES_A[(i - 1) % len(LAST_NAMES_A)]
                name = f"{first} {last}"
                email = f"student.a.{i:02d}@comp.academic.edu"

            # 4 Batches: B1 (1-18), B2 (19-36), B3 (37-53), B4 (54-70)
            if i <= 18:
                batch_key = "B1"
            elif i <= 36:
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
            elif i <= 36:
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
        print(f"[*] Created 70 students in COMP-A (4 Batches: B1: 18, B2: 18, B3: 17, B4: 17)")
        print(f"[*] Created 70 students in COMP-B (4 Batches: B1: 18, B2: 18, B3: 17, B4: 17)")

        # Seed Semester 5 (July – Dec 2026) [Ongoing]
        await seed_term(
            db=db,
            academic_term=TERM_SEM5,
            semester_num=5,
            core_courses_meta=CORE_COURSES_SEM5,
            elective_courses_meta=ELECTIVE_COURSES_SEM5,
            dept_comp=dept_comp,
            div_a=div_a,
            div_b=div_b,
            faculty_map=faculty_map,
            students_a=students_a,
            students_b=students_b,
        )

        # Seed Semester 6 (Jan – June 2027) [Upcoming]
        await seed_term(
            db=db,
            academic_term=TERM_SEM6,
            semester_num=6,
            core_courses_meta=CORE_COURSES_SEM6,
            elective_courses_meta=ELECTIVE_COURSES_SEM6,
            dept_comp=dept_comp,
            div_a=div_a,
            div_b=div_b,
            faculty_map=faculty_map,
            students_a=students_a,
            students_b=students_b,
        )

        await db.commit()
        print("\n" + "=" * 70)
        print("[SUCCESS] ENVIRONMENT FULLY CONFIGURED & SEEDED:")
        print("  - Total Faculty: Exactly 18 (All assigned teaching roles in Sem 5)")
        print("  - Total Students: Exactly 140 (COMP-A: 70, COMP-B: 70)")
        print("  - Division Batches: Exactly 4 (B1: 18, B2: 18, B3: 17, B4: 17)")
        print("  - SEM 5 (July – Dec 2026): 5 Core + Allocated Electives (Ongoing)")
        print("    * Prof. David Vance: Computer Networks (COMP-A-Theory + 4 Lab Batches B1, B2, B3, B4)")
        print("    * Alex Mercer: 5 Core + Blockchain + Image Proc Lab + Health Wellness")
        print("  - SEM 6 (Jan – June 2027): 5 Core + Electives (Upcoming)")
        print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(seed_database())
