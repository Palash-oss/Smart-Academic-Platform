import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import sync_engine
from app.db.models import Base

def fix_all_columns():
    with sync_engine.begin() as conn:
        print("[*] Ensuring all Base.metadata tables exist...")
        Base.metadata.create_all(conn)

        # 1. attendance_logs
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_logs';"))
        att_cols = {r[0] for r in res.fetchall()}
        if "course_id" not in att_cols:
            print("[+] Adding attendance_logs.course_id")
            conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;"))

        # 2. users
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';"))
        user_cols = {r[0] for r in res.fetchall()}
        if "department_id" not in user_cols:
            print("[+] Adding users.department_id")
            conn.execute(text("ALTER TABLE users ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;"))
        if "division_id" not in user_cols:
            print("[+] Adding users.division_id")
            conn.execute(text("ALTER TABLE users ADD COLUMN division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;"))
        if "student_erp_id" not in user_cols:
            print("[+] Adding users.student_erp_id")
            conn.execute(text("ALTER TABLE users ADD COLUMN student_erp_id VARCHAR(50) UNIQUE;"))
        if "roll_no" not in user_cols:
            print("[+] Adding users.roll_no")
            conn.execute(text("ALTER TABLE users ADD COLUMN roll_no VARCHAR(30) UNIQUE;"))

        # 3. courses
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'courses';"))
        course_cols = {r[0] for r in res.fetchall()}
        if "course_tier" not in course_cols:
            print("[+] Adding courses.course_tier")
            conn.execute(text("ALTER TABLE courses ADD COLUMN course_tier VARCHAR(20) DEFAULT 'CLASS';"))
        if "delivery_mode" not in course_cols:
            print("[+] Adding courses.delivery_mode")
            conn.execute(text("ALTER TABLE courses ADD COLUMN delivery_mode VARCHAR(30) DEFAULT 'INTEGRATED_TH_PR';"))
        if "th_hours" not in course_cols:
            print("[+] Adding courses.th_hours")
            conn.execute(text("ALTER TABLE courses ADD COLUMN th_hours INTEGER DEFAULT 3;"))
        if "pr_hours" not in course_cols:
            print("[+] Adding courses.pr_hours")
            conn.execute(text("ALTER TABLE courses ADD COLUMN pr_hours INTEGER DEFAULT 2;"))
        if "tu_hours" not in course_cols:
            print("[+] Adding courses.tu_hours")
            conn.execute(text("ALTER TABLE courses ADD COLUMN tu_hours INTEGER DEFAULT 0;"))

        # 4. documents
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'documents';"))
        doc_cols = {r[0] for r in res.fetchall()}
        if "department_id" not in doc_cols:
            print("[+] Adding documents.department_id")
            conn.execute(text("ALTER TABLE documents ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;"))
        if "course_id" not in doc_cols:
            print("[+] Adding documents.course_id")
            conn.execute(text("ALTER TABLE documents ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE SET NULL;"))

        # 5. lecture_sessions
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'lecture_sessions';"))
        lec_cols = {r[0] for r in res.fetchall()}
        if lec_cols:
            if "department_id" not in lec_cols:
                conn.execute(text("ALTER TABLE lecture_sessions ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE CASCADE;"))
            if "division_id" not in lec_cols:
                conn.execute(text("ALTER TABLE lecture_sessions ADD COLUMN division_id UUID REFERENCES divisions(id) ON DELETE CASCADE;"))

        print("[OK] All database columns synchronized!")

if __name__ == "__main__":
    fix_all_columns()
