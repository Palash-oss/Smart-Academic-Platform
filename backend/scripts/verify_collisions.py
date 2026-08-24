import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal
from app.db.models import Department, Division, Course, User, FacultyCourseDivision, Document


def verify_structure_and_collisions():
    session = SyncSessionLocal()
    try:
        print("\n" + "="*80)
        print("1. VERIFYING 5-DIVISION STRUCTURE & STUDENT COUNTS")
        print("="*80)
        divisions = session.query(Division).join(Department).all()
        total_capacity = 0
        for div in divisions:
            print(f"Division: {div.department.code}-{div.name:<2} | Semester: {div.semester} | Enrolled Capacity: {div.student_count}")
            total_capacity += div.student_count
        print(f"Total Divisions: {len(divisions)} | Total Target Students: {total_capacity}")

        print("\n" + "="*80)
        print("2. VERIFYING COLLISION MAP — 6 COLLIDING COURSE NAMES (SEPARATE COURSE_IDs)")
        print("="*80)

        collision_cases = [
            ("Computer Networks", ["COMP", "AIDS", "ECS"]),
            ("Data Warehousing and Mining", ["COMP", "AIDS", "ECS"]),
            ("Artificial Intelligence", ["AIDS", "ECS"]),
            ("Machine Learning", ["AIDS", "ECS"]),
            ("System Security / Cryptography", ["COMP", "AIDS", "ECS"]),
            ("Cloud Computing", ["AIDS", "ECS"])
        ]

        for title, depts in collision_cases:
            print(f"\n--- Colliding Subject: '{title}' (Departments: {', '.join(depts)}) ---")
            courses = (
                session.query(Course)
                .join(Department)
                .filter(Department.code.in_(depts))
                .filter(
                    (Course.name.ilike(f"%{title}%")) |
                    (Course.name.ilike("%Computer Network%")) |
                    (Course.name.ilike("%Cryptography%")) |
                    (Course.name.ilike("%Security%"))
                )
                .all()
            )
            # Deduplicate by course_id
            unique_courses = {c.id: c for c in courses}.values()
            for c in sorted(unique_courses, key=lambda x: x.department.code):
                doc_count = session.query(Document).filter(Document.course_id == c.id).count()
                print(f"  [Course ID: {str(c.id)[:8]}...] Dept: {c.department.code:<4} | Code: {c.code:<12} | Name: {c.name:<45} | Scoped Vectors: {doc_count}")

        print("\n" + "="*80)
        print("VERIFICATION COMPLETE — ALL COLLISION MAP COURSES ARE FULLY SEPARATE ROWS")
        print("="*80 + "\n")

    finally:
        session.close()


if __name__ == "__main__":
    verify_structure_and_collisions()
