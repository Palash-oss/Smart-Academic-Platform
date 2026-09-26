"""
Migration script: Create Allotment Engine tables (Revision FRCRCE-3-26)

Run from the backend/ directory:
    python scripts/migrate_allotment.py

Creates new tables:
  - course_offerings, class_sections, practical_batches, student_enrollments

Extends existing tables:
  - courses: adds course_tier, delivery_mode, th_hours, pr_hours, tu_hours
  - users: adds student_erp_id, roll_no

Safe to run multiple times.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app.db.session import sync_engine
from app.db.models import Base


def column_exists(inspector, table_name, column_name):
    try:
        cols = [c["name"] for c in inspector.get_columns(table_name)]
        return column_name in cols
    except Exception:
        return False


def run_migration():
    print("[*] Running Allotment Engine migration...")

    with sync_engine.begin() as conn:
        # Step 1: Create new tables
        print("  [+] Creating allotment tables (checkfirst=True)...")
        Base.metadata.create_all(sync_engine, checkfirst=True)
        print("  [OK] Tables created or already exist")

        inspector = inspect(sync_engine)

        # Step 2: Add new columns to courses
        new_course_cols = [
            ("course_tier",   "VARCHAR(20) NOT NULL DEFAULT 'CLASS'"),
            ("delivery_mode", "VARCHAR(30) NOT NULL DEFAULT 'INTEGRATED_TH_PR'"),
            ("th_hours",      "INTEGER NOT NULL DEFAULT 3"),
            ("pr_hours",      "INTEGER NOT NULL DEFAULT 2"),
            ("tu_hours",      "INTEGER NOT NULL DEFAULT 0"),
        ]
        for col_name, col_def in new_course_cols:
            if not column_exists(inspector, "courses", col_name):
                print(f"  [+] Adding courses.{col_name}")
                conn.execute(text(f"ALTER TABLE courses ADD COLUMN IF NOT EXISTS {col_name} {col_def}"))
            else:
                print(f"  [=] courses.{col_name} already exists")

        # Step 3: Add new columns to users
        new_user_cols = [
            ("student_erp_id", "VARCHAR(50) UNIQUE"),
            ("roll_no",        "VARCHAR(30) UNIQUE"),
        ]
        for col_name, col_def in new_user_cols:
            if not column_exists(inspector, "users", col_name):
                print(f"  [+] Adding users.{col_name}")
                conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def}"))
            else:
                print(f"  [=] users.{col_name} already exists")

        # Step 4: Update role check constraint to include ADMIN
        print("  [*] Updating role check constraint...")
        try:
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role"))
            conn.execute(text(
                "ALTER TABLE users ADD CONSTRAINT check_user_role "
                "CHECK (role IN ('STUDENT', 'FACULTY', 'ADMIN'))"
            ))
            print("  [OK] Role constraint updated (STUDENT, FACULTY, ADMIN)")
        except Exception as e:
            print(f"  [!] Could not update role constraint: {e}")

    print("")
    print("[DONE] Allotment Engine migration complete!")
    print("  New tables: course_offerings, class_sections, practical_batches, student_enrollments")
    print("  Updated:    courses (tier/mode/hours), users (student_erp_id, roll_no)")


if __name__ == "__main__":
    run_migration()
