import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import SyncSessionLocal, sync_engine
from app.db.models import Base, User, Department, Division, Course
from app.core.security import hash_password
from scripts.generate_sample_allotment import generate

def setup():
    print("[*] 1. Initializing schema and tables...")
    Base.metadata.create_all(bind=sync_engine)

    with sync_engine.begin() as conn:
        # Check users table columns
        res = conn.execute(text("""
            SELECT column_name FROM information_schema.columns WHERE table_name = 'users';
        """))
        cols = {r[0] for r in res.fetchall()}
        
        if "department_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;"))
            
        if "division_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;"))
            
        if "student_erp_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN student_erp_id VARCHAR(50) UNIQUE;"))
            
        if "roll_no" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN roll_no VARCHAR(30) UNIQUE;"))

        conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;"))
        conn.execute(text("ALTER TABLE users ADD CONSTRAINT check_user_role CHECK (role IN ('STUDENT', 'FACULTY', 'ADMIN'));"))

    session = SyncSessionLocal()
    try:
        print("[*] 2. Seeding Department & Division...")
        ce_dept = session.query(Department).filter_by(code="CE").first()
        if not ce_dept:
            ce_dept = Department(
                id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
                name="Computer Engineering",
                code="CE"
            )
            session.add(ce_dept)
            session.flush()

        div_a = session.query(Division).filter_by(name="CE-A").first()
        if not div_a:
            div_a = Division(
                id=uuid.UUID("22222222-2222-2222-2222-222222222221"),
                department_id=ce_dept.id,
                name="CE-A",
                semester=5,
                student_count=60
            )
            session.add(div_a)

        div_b = session.query(Division).filter_by(name="CE-B").first()
        if not div_b:
            div_b = Division(
                id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
                department_id=ce_dept.id,
                name="CE-B",
                semester=5,
                student_count=60
            )
            session.add(div_b)

        print("[*] 3. Seeding Revision FRCRCE-3-26 Courses...")
        courses_data = [
            ("25PCC13CE19", "Advanced Database Management Systems", 5, "CLASS", "INTEGRATED_TH_PR", 3, 2, 0),
            ("25PCC13CE22", "Theory of Computer Science", 5, "CLASS", "THEORY_TUTORIAL", 3, 0, 1),
            ("25VSE13CE04", "DevOps & Cloud Computing Laboratory", 5, "CLASS", "PRACTICAL_ONLY", 0, 4, 0),
            ("25PCC13CE21", "Software Engineering & Agile Project Management", 5, "CLASS", "THEORY_ONLY", 3, 0, 0),
            ("25PEC13CE11", "Machine Learning & Pattern Recognition", 5, "DEPARTMENT", "INTEGRATED_TH_PR", 3, 2, 0),
            ("25OE13CE3X", "Entrepreneurship & Technology Management", 5, "INSTITUTE", "THEORY_ONLY", 3, 0, 0),
        ]

        for code, name, sem, tier, mode, th, pr, tu in courses_data:
            existing_c = session.query(Course).filter_by(code=code).first()
            if not existing_c:
                c = Course(
                    department_id=ce_dept.id,
                    name=name,
                    code=code,
                    semester=sem,
                    course_tier=tier,
                    delivery_mode=mode,
                    th_hours=th,
                    pr_hours=pr,
                    tu_hours=tu
                )
                session.add(c)
            else:
                existing_c.course_tier = tier
                existing_c.delivery_mode = mode
                existing_c.th_hours = th
                existing_c.pr_hours = pr
                existing_c.tu_hours = tu

        print("[*] 4. Seeding Demo Users (Student, Faculty, Admin)...")
        # Student
        std = session.query(User).filter_by(email="student@academic.edu").first()
        if not std:
            std = User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                email="student@academic.edu",
                hashed_password=hash_password("student123"),
                full_name="Alex Mercer",
                role="STUDENT",
                student_erp_id="2023CE001",
                roll_no="CE-A-01",
                department_id=ce_dept.id,
                division_id=div_a.id
            )
            session.add(std)
        else:
            std.student_erp_id = std.student_erp_id or "2023CE001"
            std.roll_no = std.roll_no or "CE-A-01"

        # Faculty
        fac = session.query(User).filter_by(email="faculty@academic.edu").first()
        if not fac:
            fac = User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
                email="faculty@academic.edu",
                hashed_password=hash_password("faculty123"),
                full_name="Prof. David Vance",
                role="FACULTY",
                department_id=ce_dept.id
            )
            session.add(fac)

        # Admin
        adm = session.query(User).filter_by(email="admin@academic.edu").first()
        if not adm:
            adm = User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000004"),
                email="admin@academic.edu",
                hashed_password=hash_password("admin123"),
                full_name="Academic Dean / Admin",
                role="ADMIN"
            )
            session.add(adm)

        session.commit()
        print("[OK] Database seeded successfully with demo users and courses!")

    finally:
        session.close()

    print("[*] 5. Generating sample allotment spreadsheet...")
    generate()

if __name__ == "__main__":
    setup()
