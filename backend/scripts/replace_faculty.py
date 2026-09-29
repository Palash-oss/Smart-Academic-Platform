"""
Script to replace all current faculty with the 22 college faculty from the Google Sheet.
Google Sheet: https://docs.google.com/spreadsheets/d/1fTBdcpQP_3vJ_BZI5yS36z0KGQOVOgWmRvqXqPw19nc/edit?usp=sharing
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal
from app.core.security import hash_password
from app.db.models import (
    User, Department, Division, Course, CourseOffering, ClassSection, PracticalBatch, FacultyCourseDivision,
)

COLLEGE_FACULTY = [
    {
        "sr_no": 1,
        "name": "Dr. Sujata Deshmukh",
        "email": "sujata.deshmukh@academic.edu",
        "subjects": ["Dataware Housing and Mining"],
        "category": "TE CE B",
    },
    {
        "sr_no": 2,
        "name": "Prof. Merly Thomas",
        "email": "merly.thomas@academic.edu",
        "subjects": ["Computer Networks"],
        "category": "TE CE",
    },
    {
        "sr_no": 3,
        "name": "Dr. Monica Khanore",
        "email": "monica.khanore@academic.edu",
        "subjects": ["Cryptography and System Security"],
        "category": "TE CE",
    },
    {
        "sr_no": 4,
        "name": "Dr. Ashok Kanthe",
        "email": "ashok.kanthe@academic.edu",
        "subjects": ["Computer Networks"],
        "category": "TE CE",
    },
    {
        "sr_no": 5,
        "name": "Dr. Roshni Padate",
        "email": "roshni.padate@academic.edu",
        "subjects": ["Human Machine Interface", "Natural Language Processing Lab"],
        "category": "TE CE (Elect) / TE CE (PEL)",
    },
    {
        "sr_no": 6,
        "name": "Dr. Smita Ambarkar",
        "email": "smita.ambarkar@academic.edu",
        "subjects": ["Cryptography and System Security", "Cyber Security"],
        "category": "TE CE / TE CE (PEC)",
    },
    {
        "sr_no": 7,
        "name": "Dr. Kalpana Deorukhkar",
        "email": "kalpana.deorukhkar@academic.edu",
        "subjects": ["Theoretical Computer Science and Compiler Construction", "Deep Learning and Reinforcement Learning (PEC)"],
        "category": "TE CE / TE CE (PEC)",
    },
    {
        "sr_no": 8,
        "name": "Prof. Ashwini Pansare",
        "email": "ashwini.pansare@academic.edu",
        "subjects": ["Deep Learning and Reinforcement Learning (PEC)"],
        "category": "TE CE (PEC)",
    },
    {
        "sr_no": 9,
        "name": "Dr. Supriya Kamoji",
        "email": "supriya.kamoji@academic.edu",
        "subjects": ["Cloud Computing"],
        "category": "TE CE",
    },
    {
        "sr_no": 10,
        "name": "Prof. Sushma Nagdeote",
        "email": "sushma.nagdeote@academic.edu",
        "subjects": ["Dataware Housing and Mining"],
        "category": "TE CE A",
    },
    {
        "sr_no": 11,
        "name": "Dr. Monali Shetty",
        "email": "monali.shetty@academic.edu",
        "subjects": ["Cryptography and System Security"],
        "category": "TE CE",
    },
    {
        "sr_no": 12,
        "name": "Prof. Sangeeta Parshionikar",
        "email": "sangeeta.parshionikar@academic.edu",
        "subjects": ["Deep Learning and Reinforcement Learning (PEC)"],
        "category": "TE CE (PEC)",
    },
    {
        "sr_no": 13,
        "name": "Prof. Lokhande Unik",
        "email": "unik.lokhande@academic.edu",
        "subjects": ["Cloud Computing", "Ethical Hacking Laboratory"],
        "category": "TE CE / TE CE (PEL)",
    },
    {
        "sr_no": 14,
        "name": "Prof. Ankita Amburle",
        "email": "ankita.amburle@academic.edu",
        "subjects": ["Theoretical Computer Science and Compiler Construction", "Big Data Analytics", "Natural Language Processing Lab"],
        "category": "TE CE / TE CE (PEC) / TE CE (PEL)",
    },
    {
        "sr_no": 15,
        "name": "Dr. Vijay Shelake",
        "email": "vijay.shelake@academic.edu",
        "subjects": ["Cloud Computing"],
        "category": "TE CE",
    },
    {
        "sr_no": 16,
        "name": "Prof. Nirajsingh R Yeotikar",
        "email": "nirajsingh.yeotikar@academic.edu",
        "subjects": ["Innovative Product Development Lab - Phase 1 (Start-up)"],
        "category": "TE CE (PEL)",
    },
    {
        "sr_no": 17,
        "name": "Prof. Prity Bansode",
        "email": "prity.bansode@academic.edu",
        "subjects": ["Dataware Housing and Mining", "Natural Language Processing Lab"],
        "category": "TE CE / TE CE (PEL)",
    },
    {
        "sr_no": 18,
        "name": "Prof. Khushboo Singh",
        "email": "khushboo.singh@academic.edu",
        "subjects": ["Computer Networks", "Human Machine Interface"],
        "category": "TE CE / TE CE (PEC)",
    },
    {
        "sr_no": 19,
        "name": "Prof. Garima Singh",
        "email": "garima.singh@academic.edu",
        "subjects": ["Human Machine Interface"],
        "category": "TE CE (PEC)",
    },
    {
        "sr_no": 20,
        "name": "Prof. Varsha Phulpagar",
        "email": "varsha.phulpagar@academic.edu",
        "subjects": ["Natural Language Processing Lab"],
        "category": "TE CE (PEL)",
    },
    {
        "sr_no": 21,
        "name": "Prof. Akshata Satyawan Patil",
        "email": "akshata.patil@academic.edu",
        "subjects": ["Cyber Security", "Natural Language Processing Lab"],
        "category": "TE CE (PEC) / TE CE (PEL)",
    },
    {
        "sr_no": 22,
        "name": "Prof. Kranti Kiran Wagle",
        "email": "kranti.wagle@academic.edu",
        "subjects": ["Natural Language Processing Lab"],
        "category": "TE CE (PEL)",
    },
]


async def replace_faculty():
    async with AsyncSessionLocal() as db:
        print("[*] Starting faculty purge and replacement...")

        # 1. Get Department
        res = await db.execute(select(Department).where(Department.code == "COMP"))
        dept_comp = res.scalar_one_or_none()
        if not dept_comp:
            dept_comp = Department(id=uuid.uuid4(), code="COMP", name="Computer Engineering")
            db.add(dept_comp)
            await db.flush()

        # 2. Clear old faculty foreign keys in ClassSection and PracticalBatch
        await db.execute(update(ClassSection).values(faculty_id=None))
        await db.execute(update(PracticalBatch).values(faculty_id=None))
        await db.execute(delete(FacultyCourseDivision))
        await db.flush()

        # 3. Delete all old faculty users
        del_fac = await db.execute(delete(User).where(User.role == "FACULTY"))
        print(f"[*] Deleted {del_fac.rowcount} existing faculty members.")
        await db.flush()

        # 4. Insert the 22 new college faculty
        pw_hash = hash_password("faculty123")
        created_map = {}

        for f in COLLEGE_FACULTY:
            user = User(
                id=uuid.uuid4(),
                email=f["email"],
                hashed_password=pw_hash,
                full_name=f["name"],
                role="FACULTY",
                department_id=dept_comp.id,
            )
            db.add(user)
            await db.flush()
            created_map[f["email"]] = user
            print(f"  + Added: {f['name']} <{f['email']}>")

        # Also add faculty@academic.edu alias pointing to Dr. Sujata Deshmukh for backward compatibility
        demo_user = User(
            id=uuid.uuid4(),
            email="faculty@academic.edu",
            hashed_password=pw_hash,
            full_name="Dr. Sujata Deshmukh",
            role="FACULTY",
            department_id=dept_comp.id,
        )
        db.add(demo_user)
        await db.flush()
        created_map["faculty@academic.edu"] = demo_user
        print(f"  + Added: Demo Faculty Account <faculty@academic.edu>")

        # 5. Re-assign core courses in Sem 5 according to the college sheet!
        print("[*] Assigning core course sections and batches to new college faculty...")
        
        # Query Sem 5 offerings
        off_stmt = select(CourseOffering).join(Course).where(
            CourseOffering.academic_term == "2026-27-SEM5",
            Course.course_tier == "CLASS"
        ).options(selectinload(CourseOffering.course))
        off_res = await db.execute(off_stmt)
        core_offerings = off_res.scalars().all()

        for off in core_offerings:
            course = off.course
            c_code = course.code

            # Sections
            sec_res = await db.execute(select(ClassSection).where(ClassSection.offering_id == off.id))
            sections = sec_res.scalars().all()

            # Batches
            batch_res = await db.execute(select(PracticalBatch).where(PracticalBatch.offering_id == off.id))
            batches = batch_res.scalars().all()

            if c_code == "25PCC13CE14":
                # Data Warehousing and Mining
                # A: Sushma Nagdeote, B: Sujata Deshmukh
                fac_a = created_map["sushma.nagdeote@academic.edu"]
                fac_b = created_map["sujata.deshmukh@academic.edu"]
                fac_prity = created_map["prity.bansode@academic.edu"]

                for s in sections:
                    if "A" in s.section_name:
                        s.faculty_id = fac_a.id
                    elif "B" in s.section_name:
                        s.faculty_id = fac_b.id

                for b in batches:
                    if "A" in b.batch_name:
                        b.faculty_id = fac_a.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_prity.id
                    elif "B" in b.batch_name:
                        b.faculty_id = fac_b.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_prity.id

            elif c_code == "25PCC13CE22":
                # Computer Networks
                # A: Merly Thomas, B: Ashok Kanthe
                fac_merly = created_map["merly.thomas@academic.edu"]
                fac_ashok = created_map["ashok.kanthe@academic.edu"]
                fac_khushboo = created_map["khushboo.singh@academic.edu"]

                for s in sections:
                    if "A" in s.section_name:
                        s.faculty_id = fac_merly.id
                    elif "B" in s.section_name:
                        s.faculty_id = fac_ashok.id

                for b in batches:
                    if "A" in b.batch_name:
                        b.faculty_id = fac_merly.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_khushboo.id
                    elif "B" in b.batch_name:
                        b.faculty_id = fac_ashok.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_khushboo.id

            elif c_code == "25PCC13CE19":
                # Cryptography and System Security
                # A: Monica Khanore, B: Monali Shetty
                fac_monica = created_map["monica.khanore@academic.edu"]
                fac_monali = created_map["monali.shetty@academic.edu"]
                fac_smita = created_map["smita.ambarkar@academic.edu"]

                for s in sections:
                    if "A" in s.section_name:
                        s.faculty_id = fac_monica.id
                    elif "B" in s.section_name:
                        s.faculty_id = fac_monali.id

                for b in batches:
                    if "A" in b.batch_name:
                        b.faculty_id = fac_monica.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_smita.id
                    elif "B" in b.batch_name:
                        b.faculty_id = fac_monali.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_smita.id

            elif c_code == "25PCC13CE21":
                # Theory of Computer Science
                # A: Kalpana Deorukhkar, B: Ankita Amburle
                fac_kalpana = created_map["kalpana.deorukhkar@academic.edu"]
                fac_ankita = created_map["ankita.amburle@academic.edu"]

                for s in sections:
                    if "A" in s.section_name:
                        s.faculty_id = fac_kalpana.id
                    elif "B" in s.section_name:
                        s.faculty_id = fac_ankita.id

                for b in batches:
                    if "A" in b.batch_name:
                        b.faculty_id = fac_kalpana.id
                    elif "B" in b.batch_name:
                        b.faculty_id = fac_ankita.id

            elif c_code == "25VSE13CE04":
                # Cloud Computing Laboratory
                fac_supriya = created_map["supriya.kamoji@academic.edu"]
                fac_vijay = created_map["vijay.shelake@academic.edu"]
                fac_unik = created_map["unik.lokhande@academic.edu"]

                for b in batches:
                    if "A" in b.batch_name:
                        b.faculty_id = fac_supriya.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_vijay.id
                    elif "B" in b.batch_name:
                        b.faculty_id = fac_unik.id if "B1" in b.batch_name or "B2" in b.batch_name else fac_vijay.id

        await db.commit()
        print("[*] Successfully replaced all faculty data and committed to database!")


if __name__ == "__main__":
    asyncio.run(replace_faculty())
