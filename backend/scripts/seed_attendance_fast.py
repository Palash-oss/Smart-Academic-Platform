import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal
from app.db.models import AttendanceLog, User

def seed_attendance():
    session = SyncSessionLocal()
    try:
        student = session.query(User).filter_by(email="student@academic.edu").first()
        if not student:
            print("Student not found!")
            return

        # Clear existing logs for student
        session.query(AttendanceLog).filter_by(student_id=student.id).delete()

        print(f"[*] Seeding attendance logs for {student.full_name} ({student.email})...")
        records = [
            # Data Structures: 14/20 = 70.0% (AT RISK)
            AttendanceLog(student_id=student.id, subject="Data Structures & Algorithms", total_classes=20, attended_classes=14),
            # Operating Systems: 18/20 = 90.0% (OK)
            AttendanceLog(student_id=student.id, subject="Operating Systems", total_classes=20, attended_classes=18),
            # Database Management Systems: 13/20 = 65.0% (AT RISK)
            AttendanceLog(student_id=student.id, subject="Database Management Systems", total_classes=20, attended_classes=13),
            # Computer Networks: 16/20 = 80.0% (OK)
            AttendanceLog(student_id=student.id, subject="Computer Networks", total_classes=20, attended_classes=16),
        ]
        session.add_all(records)
        session.commit()
        print(f"[OK] Seeded {len(records)} attendance logs for {student.full_name}!")
    finally:
        session.close()

if __name__ == "__main__":
    seed_attendance()
