"""
Complete Academic Foundation & Curriculum Ingestion (Revision FRCRCE-3-26)
==========================================================================
Aligns with official syllabus PDF:
- B.Tech Computer Engineering (Semester 5 and Semester 6)
- Core courses (Tier 1: CLASS) -> Auto-enrolled by Division/Semester
- Elective courses (Tier 2: DEPARTMENT) -> Ingested via Allotment Engine
- Division & Batch faculty assignment
- Clean semester separation (Sem 5 students only see Sem 5 courses)
"""

import asyncio
import os
import sys
import uuid
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal
from app.db.models import (
    Department, Division, Course, CourseOffering, ClassSection, PracticalBatch,
    StudentEnrollment, User, AttendanceLog
)
from app.core.security import hash_password
from app.services.allotment_service import AllotmentEngine, cascade_faculty_to_batches


# ─────────────────────────────────────────────────────────────────────────────
# 1. Course Master Definitions from PDF Pages 4, 5
# ─────────────────────────────────────────────────────────────────────────────

CURRICULUM_COURSES = [
    # ── SEMESTER 5 : CORE (PCC & VSEC) ──────────────────────────────────────
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PCC13CE19",
        "name": "Cryptography and System Security",
        "tier": "CLASS",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PCC13CE21",
        "name": "Theory of Computer Science",
        "tier": "CLASS",
        "mode": "THEORY_TUTORIAL",
        "th": 2, "pr": 0, "tu": 1
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PCC13CE22",
        "name": "Computer Networks",
        "tier": "CLASS",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PCC13CE14",
        "name": "Data Warehousing and Mining",
        "tier": "CLASS",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25VSE13CE04",
        "name": "Cloud Computing Laboratory",
        "tier": "CLASS",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 4, "tu": 0
    },

    # ── SEMESTER 5 : ELECTIVES (PEC-1 & PECL-1) ────────────────────────────
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE11",
        "name": "Blockchain Technology",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE12",
        "name": "Deep Learning and Reinforcement Learning",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE13",
        "name": "Cyber Security",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE14",
        "name": "Big Data Analytics",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE15",
        "name": "Computer Graphics",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE16",
        "name": "Human Machine Interface",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE17",
        "name": "Geographical Information Systems",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PEC13CE18",
        "name": "System Programming with Compiler Construction",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PECL13CE11",
        "name": "Image Processing Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PECL13CE12",
        "name": "Natural Language Processing Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PECL13CE13",
        "name": "Industrial IoT Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PECL13CE14",
        "name": "Innovative Product Development Laboratory -Phase1 (Start-up)",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25PECL13CE15",
        "name": "Ethical Hacking Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 5,
        "code": "25OE13CE3X",
        "name": "Health, Wellness and Psychology",
        "tier": "INSTITUTE",
        "mode": "THEORY_ONLY",
        "th": 2, "pr": 0, "tu": 0
    },

    # ── SEMESTER 6 : CORE (PCC) ─────────────────────────────────────────────
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE15",
        "name": "Distributed Computing",
        "tier": "CLASS",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE16",
        "name": "Software Engineering",
        "tier": "CLASS",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE17",
        "name": "Artificial Intelligence Laboratory",
        "tier": "CLASS",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE18",
        "name": "Mini Project",
        "tier": "CLASS",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE23",
        "name": "Mobile App Development",
        "tier": "CLASS",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE24",
        "name": "DevOps: Development and Operations Practices Laboratory",
        "tier": "CLASS",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE25",
        "name": "Advanced Microprocessors",
        "tier": "CLASS",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PCC13CE20",
        "name": "Competitive Coding",
        "tier": "CLASS",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },

    # ── SEMESTER 6 : ELECTIVES (PEC-2 & PECL-2) ────────────────────────────
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE21",
        "name": "Decentralized Finance",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE22",
        "name": "Generative AI",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE23",
        "name": "Digital Forensics",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE24",
        "name": "Business Intelligence",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE25",
        "name": "Augmented Reality and Virtual Reality",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE26",
        "name": "UI/UX Design",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE27",
        "name": "Quantum Computing",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PEC13CE28",
        "name": "Advanced Network Communications",
        "tier": "DEPARTMENT",
        "mode": "INTEGRATED_TH_PR",
        "th": 2, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PECL13CE21",
        "name": "Social Media Analytics Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PECL13CE22",
        "name": "Open-Source Intelligence and Threat Intelligence Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PECL13CE23",
        "name": "Advanced Java Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PECL13CE24",
        "name": "Innovative Product Development Laboratory -Phase2 (Start-up)",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PECL13CE25",
        "name": "Explainable AI Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25PECL13CE26",
        "name": "Software Testing and Quality Assurance Laboratory",
        "tier": "DEPARTMENT",
        "mode": "PRACTICAL_ONLY",
        "th": 0, "pr": 2, "tu": 0
    },
    {
        "dept_code": "COMP",
        "semester": 6,
        "code": "25OE13CE4X",
        "name": "Public Relations and Corporate Communication",
        "tier": "INSTITUTE",
        "mode": "THEORY_ONLY",
        "th": 2, "pr": 0, "tu": 0
    }
]


async def run_setup():
    academic_term = "2026-27-SEM5"
    print("=" * 70)
    print("ACADEMIC PLATFORM FOUNDATION SETUP (Revision FRCRCE-3-26)")
    print(f"Active Academic Term: {academic_term}")
    print("=" * 70)

    async with AsyncSessionLocal() as db:
        # ─────────────────────────────────────────────────────────────────────
        # Step 1: Ensure Departments
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 1. Syncing Departments...")
        dept_specs = [
            ("COMP", "Computer Engineering"),
            ("AIDS", "Artificial Intelligence & Data Science"),
            ("ECS", "Electronics & Computer Science"),
            ("MECH", "Mechanical Engineering"),
        ]
        dept_map = {}
        for code, name in dept_specs:
            res = await db.execute(select(Department).where(Department.code == code))
            dept = res.scalar_one_or_none()
            if not dept:
                dept = Department(name=name, code=code)
                db.add(dept)
                await db.flush()
            dept_map[code] = dept
        print(f"  [OK] Synchronized {len(dept_map)} departments.")

        comp_dept = dept_map["COMP"]

        # ─────────────────────────────────────────────────────────────────────
        # Step 2: Ensure Divisions
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 2. Syncing Divisions for COMP Department...")
        div_specs = [
            ("A", 5, 70),
            ("B", 5, 70),
        ]
        div_map = {}
        for name, sem, count in div_specs:
            res = await db.execute(
                select(Division).where(
                    Division.department_id == comp_dept.id,
                    Division.name == name,
                    Division.semester == sem
                )
            )
            div = res.scalar_one_or_none()
            if not div:
                div = Division(
                    department_id=comp_dept.id,
                    name=name,
                    semester=sem,
                    student_count=count
                )
                db.add(div)
                await db.flush()
            div_map[name] = div
        print(f"  [OK] Synchronized Divisions: {list(div_map.keys())}")

        div_a = div_map["A"]

        # ─────────────────────────────────────────────────────────────────────
        # Step 3: Upsert Courses from Syllabus PDF
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 3. Syncing Syllabus Courses from PDF...")
        # Remove legacy mock course codes that conflict with official revision
        legacy_codes = ["25PCC13CE11", "25PCC13CE12", "25PCC13CE13"]
        for lc in legacy_codes:
            res = await db.execute(select(Course).where(Course.code == lc))
            old_c = res.scalar_one_or_none()
            if old_c:
                await db.delete(old_c)
        await db.flush()

        courses_by_code = {}
        for spec in CURRICULUM_COURSES:
            target_dept = dept_map.get(spec["dept_code"], comp_dept)
            res = await db.execute(select(Course).where(Course.code == spec["code"]))
            c = res.scalar_one_or_none()
            if not c:
                c = Course(
                    department_id=target_dept.id,
                    name=spec["name"],
                    code=spec["code"],
                    semester=spec["semester"],
                    course_tier=spec["tier"],
                    delivery_mode=spec["mode"],
                    th_hours=spec["th"],
                    pr_hours=spec["pr"],
                    tu_hours=spec["tu"]
                )
                db.add(c)
                await db.flush()
            else:
                c.name = spec["name"]
                c.semester = spec["semester"]
                c.course_tier = spec["tier"]
                c.delivery_mode = spec["mode"]
                c.th_hours = spec["th"]
                c.pr_hours = spec["pr"]
                c.tu_hours = spec["tu"]
                await db.flush()
            courses_by_code[c.code] = c

        print(f"  [OK] Synchronized {len(courses_by_code)} courses (Sem 5 & Sem 6).")

        # ─────────────────────────────────────────────────────────────────────
        # Step 4: Ensure Demo Users Exist
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 4. Syncing Demo Users...")
        # Demo Admin
        res_adm = await db.execute(select(User).where(User.email == "admin@academic.edu"))
        adm = res_adm.scalar_one_or_none()
        if not adm:
            adm = User(
                email="admin@academic.edu",
                hashed_password=hash_password("admin123"),
                full_name="Academic Dean / Admin",
                role="ADMIN"
            )
            db.add(adm)
        else:
            adm.hashed_password = hash_password("admin123")
            adm.role = "ADMIN"

        # Demo Faculty
        res_fac = await db.execute(select(User).where(User.email == "faculty@academic.edu"))
        fac = res_fac.scalar_one_or_none()
        if not fac:
            fac = User(
                email="faculty@academic.edu",
                hashed_password=hash_password("faculty123"),
                full_name="Prof. David Vance",
                role="FACULTY",
                department_id=comp_dept.id
            )
            db.add(fac)
        else:
            fac.department_id = comp_dept.id
            fac.hashed_password = hash_password("faculty123")

        # Demo Student: Alex Mercer (Standard Student)
        res_std = await db.execute(select(User).where(User.email == "student@academic.edu"))
        std = res_std.scalar_one_or_none()
        if not std:
            std = User(
                email="student@academic.edu",
                hashed_password=hash_password("student123"),
                full_name="Alex Mercer",
                role="STUDENT",
                student_erp_id="2023CE001",
                roll_no="CE-A-01",
                department_id=comp_dept.id,
                division_id=div_a.id
            )
            db.add(std)
        else:
            std.department_id = comp_dept.id
            std.division_id = div_a.id
            std.roll_no = "CE-A-01"
            std.student_erp_id = "2023CE001"
            std.hashed_password = hash_password("student123")

        # Demo Student: Rahul Sharma (At-Risk Student, 71.6%)
        res_risk = await db.execute(select(User).where(User.email == "atrisk.student@academic.edu"))
        risk_std = res_risk.scalar_one_or_none()
        if not risk_std:
            risk_std = User(
                email="atrisk.student@academic.edu",
                hashed_password=hash_password("student123"),
                full_name="Rahul Sharma",
                role="STUDENT",
                student_erp_id="2023CE015",
                roll_no="CE-A-15",
                department_id=comp_dept.id,
                division_id=div_a.id
            )
            db.add(risk_std)
        else:
            risk_std.department_id = comp_dept.id
            risk_std.division_id = div_a.id
            risk_std.roll_no = "CE-A-15"
            risk_std.student_erp_id = "2023CE015"
            risk_std.hashed_password = hash_password("student123")

        await db.flush()
        print("  [OK] Demo users ready: admin@academic.edu, faculty@academic.edu, student@academic.edu, atrisk.student@academic.edu")

        # ─────────────────────────────────────────────────────────────────────
        # Step 5: Run Core Auto-Enrollment (Zero Manual Effort for Core!)
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 5. Running Core Auto-Enrollment for Active Term (2026-27-SEM5)...")
        engine = AllotmentEngine(db)
        core_summary = await engine.auto_enroll_core_for_term(academic_term)
        print(f"  [OK] Core Auto-Enrollment Complete: {core_summary['total_enrollments_created']} student enrollments created!")

        # ─────────────────────────────────────────────────────────────────────
        # Step 6: Allot Electives (PEC-1 & PECL-1 for Demo Students)
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 6. Allotting Elective Courses (PEC-1 Blockchain + PECL-1 Ethical Hacking)...")
        # Ensure offerings for electives
        blockchain_c = courses_by_code["25PEC13CE11"]
        hacking_c = courses_by_code["25PECL13CE15"]

        bc_off = await engine._get_or_create_offering(blockchain_c, academic_term)
        hack_off = await engine._get_or_create_offering(hacking_c, academic_term)

        # Blockchain Theory Section & Lab Batch
        bc_sec = await engine._get_or_create_section(bc_off, "PEC13CE11-Sec1")
        bc_batch = await engine._get_or_create_batch(bc_off, "PEC13CE11-Sec1-Lab1", parent_section=bc_sec)

        # Ethical Hacking Lab Batch (PRACTICAL_ONLY)
        hack_batch = await engine._get_or_create_batch(hack_off, "PECL13CE15-Lab1")

        # Enroll demo students into their chosen electives
        for student_obj in [std, risk_std]:
            await engine._upsert_enrollment(student_obj, bc_off, section=bc_sec, batch=bc_batch)
            await engine._upsert_enrollment(student_obj, hack_off, section=None, batch=hack_batch)

        print("  [OK] Elective enrollments created for demo students!")

        # ─────────────────────────────────────────────────────────────────────
        # Step 7: Faculty Allocation (Division & Batch Scoped)
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 7. Allocating Faculty (Prof. David Vance) to Division & Batches...")
        # 1. Cryptography (25PCC13CE19): Vance teaches COMP-A-Theory + COMP-A-B1 Lab
        crypto_off_res = await db.execute(
            select(CourseOffering)
            .where(CourseOffering.course_id == courses_by_code["25PCC13CE19"].id, CourseOffering.academic_term == academic_term)
            .options(selectinload(CourseOffering.sections), selectinload(CourseOffering.batches))
        )
        crypto_off = crypto_off_res.scalar_one_or_none()
        if crypto_off:
            for s in crypto_off.sections:
                if "A" in s.section_name:
                    s.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to Theory: {s.section_name} ({crypto_off.course_id})")
            for b in crypto_off.batches:
                if "B1" in b.batch_name:
                    b.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to Lab Batch: {b.batch_name}")

        # 2. Cloud Computing Lab (25VSE13CE04): Vance teaches Batch B1
        cloud_off_res = await db.execute(
            select(CourseOffering)
            .where(CourseOffering.course_id == courses_by_code["25VSE13CE04"].id, CourseOffering.academic_term == academic_term)
            .options(selectinload(CourseOffering.batches))
        )
        cloud_off = cloud_off_res.scalar_one_or_none()
        if cloud_off:
            for b in cloud_off.batches:
                if "B1" in b.batch_name:
                    b.faculty_id = fac.id
                    print(f"  [+] Assigned Prof. Vance to Cloud Lab Batch: {b.batch_name}")

        # 3. Blockchain Elective: Vance teaches Section 1
        bc_sec.faculty_id = fac.id
        bc_batch.faculty_id = fac.id
        print(f"  [+] Assigned Prof. Vance to Elective: {bc_sec.section_name}")

        # ─────────────────────────────────────────────────────────────────────
        # Step 8: Clean Attendance Logs (Strictly Sem-5 Courses, Zero Sem-6 Leaks!)
        # ─────────────────────────────────────────────────────────────────────
        print("[*] 8. Normalizing Student Attendance Logs strictly for Semester 5...")
        # Remove any lingering Sem-6 records for demo students
        sem5_course_names = [
            "Cryptography and System Security (25PCC13CE19)",
            "Theory of Computer Science (25PCC13CE21)",
            "Computer Networks (25PCC13CE22)",
            "Data Warehousing and Mining (25PCC13CE14)",
            "Cloud Computing Laboratory (25VSE13CE04)",
            "Blockchain Technology (25PEC13CE11)",
            "Ethical Hacking Laboratory (25PECL13CE15)",
        ]

        # Reset attendance logs for Alex Mercer (Good attendance ~88%)
        await db.execute(delete(AttendanceLog).where(AttendanceLog.student_id == std.id))
        alex_records = [
            ("Cryptography and System Security (25PCC13CE19)", 28, 25, courses_by_code["25PCC13CE19"].id),
            ("Theory of Computer Science (25PCC13CE21)", 26, 23, courses_by_code["25PCC13CE21"].id),
            ("Computer Networks (25PCC13CE22)", 27, 24, courses_by_code["25PCC13CE22"].id),
            ("Data Warehousing and Mining (25PCC13CE14)", 26, 23, courses_by_code["25PCC13CE14"].id),
            ("Cloud Computing Laboratory (25VSE13CE04)", 24, 22, courses_by_code["25VSE13CE04"].id),
            ("Blockchain Technology (25PEC13CE11)", 25, 22, courses_by_code["25PEC13CE11"].id),
            ("Ethical Hacking Laboratory (25PECL13CE15)", 24, 21, courses_by_code["25PECL13CE15"].id),
        ]
        for sub, total, att, cid in alex_records:
            db.add(AttendanceLog(
                student_id=std.id,
                course_id=cid,
                subject=sub,
                total_classes=total,
                attended_classes=att
            ))

        # Reset attendance logs for Rahul Sharma (At-Risk student ~71.6%)
        await db.execute(delete(AttendanceLog).where(AttendanceLog.student_id == risk_std.id))
        rahul_records = [
            ("Cryptography and System Security (25PCC13CE19)", 27, 20, courses_by_code["25PCC13CE19"].id), # 74.07%
            ("Theory of Computer Science (25PCC13CE21)", 28, 20, courses_by_code["25PCC13CE21"].id),       # 71.43%
            ("Computer Networks (25PCC13CE22)", 26, 18, courses_by_code["25PCC13CE22"].id),                # 69.23%
            ("Data Warehousing and Mining (25PCC13CE14)", 26, 19, courses_by_code["25PCC13CE14"].id),      # 73.08%
            ("Cloud Computing Laboratory (25VSE13CE04)", 24, 17, courses_by_code["25VSE13CE04"].id),       # 70.83%
            ("Blockchain Technology (25PEC13CE11)", 25, 18, courses_by_code["25PEC13CE11"].id),            # 72.00%
            ("Ethical Hacking Laboratory (25PECL13CE15)", 24, 17, courses_by_code["25PECL13CE15"].id),      # 70.83%
        ]
        for sub, total, att, cid in rahul_records:
            db.add(AttendanceLog(
                student_id=risk_std.id,
                course_id=cid,
                subject=sub,
                total_classes=total,
                attended_classes=att
            ))

        await db.commit()
        print("  [OK] Student attendance records populated exclusively for Semester 5!")

    print("\n" + "=" * 70)
    print("[SUCCESS] Academic Platform Foundation Initialized with Complete Integrity!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_setup())
