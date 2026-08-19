import sys
import os
import uuid
import random

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal, sync_engine, Base
from app.db.models import User, AttendanceLog, Document, DocumentEmbedding
from app.core.security import hash_password
from app.services.retrieval_service import get_text_embedding

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    fake = None


REALISTIC_STUDENT_NAMES = [
    ("Alex Mercer", "alex.mercer@academic.edu"),
    ("Sarah Jenkins", "sarah.jenkins@academic.edu"),
    ("Marcus Chen", "marcus.chen@academic.edu"),
    ("Elena Rostova", "elena.rostova@academic.edu"),
    ("David Kim", "david.kim@academic.edu"),
    ("Priya Patel", "priya.patel@academic.edu"),
    ("Liam O'Connor", "liam.oconnor@academic.edu"),
    ("Aisha Al-Mansoor", "aisha.almansoor@academic.edu"),
    ("Carlos Rodriguez", "carlos.rodriguez@academic.edu"),
    ("Hannah Abbott", "hannah.abbott@academic.edu"),
    ("Vikram Singh", "vikram.singh@academic.edu"),
    ("Sophia Martinez", "sophia.martinez@academic.edu"),
    ("James Wilson", "james.wilson@academic.edu"),
    ("Zoe Zhang", "zoe.zhang@academic.edu"),
    ("Gabriel Silva", "gabriel.silva@academic.edu"),
    ("Emily Thorne", "emily.thorne@academic.edu"),
    ("Rohan Sharma", "rohan.sharma@academic.edu"),
    ("Chloe Dubois", "chloe.dubois@academic.edu")
]

SUBJECTS = [
    "Data Structures & Algorithms",
    "Operating Systems",
    "Database Management Systems",
    "Computer Networks"
]


def generate_realistic_dataset():
    """Feature 3: Generates a realistic classroom dataset of 18 students across 4 subjects.
    
    Distribution:
    - ~60% Good Standing (>=75%)
    - ~25% Warning (60-74.9%)
    - ~15% Critical (<60%)
    """
    print("Initializing Database Schema...")
    Base.metadata.create_all(bind=sync_engine)

    session = SyncSessionLocal()
    try:
        print("Clearing previous demo records...")
        session.query(AttendanceLog).delete()
        session.query(DocumentEmbedding).delete()
        session.query(Document).delete()
        session.query(User).delete()
        session.commit()

        # 1. Faculty Member
        faculty = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
            email="faculty@academic.edu",
            hashed_password=hash_password("faculty123"),
            full_name="Prof. David Vance",
            role="FACULTY"
        )
        session.add(faculty)

        # Fixed student accounts for demo 1-click login
        demo_student_1 = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="student@academic.edu",
            hashed_password=hash_password("student123"),
            full_name="Alex Mercer",
            role="STUDENT"
        )
        session.add(demo_student_1)

        # Generate 17 additional students
        students = [demo_student_1]
        for name, email in REALISTIC_STUDENT_NAMES[1:]:
            student_user = User(
                email=email,
                hashed_password=hash_password("student123"),
                full_name=name,
                role="STUDENT"
            )
            session.add(student_user)
            students.append(student_user)

        session.commit()
        print(f"Created {len(students)} Student Accounts & 1 Faculty Account.")

        # 2. Generate Attendance Logs with 60% / 25% / 15% distribution
        print("Generating Attendance Logs with Realistic Risk Distribution...")
        attendance_logs = []

        # Determine target standing per student
        for idx, student in enumerate(students):
            # Assign category:
            # First 60% -> Good Standing (75-95%)
            # Next 25% -> Warning Band (60-74%)
            # Last 15% -> Critical Band (40-59%)
            ratio = idx / len(students)
            if ratio < 0.60:
                standing = "good"
            elif ratio < 0.85:
                standing = "warning"
            else:
                standing = "critical"

            for subject in SUBJECTS:
                total_cls = random.randint(18, 22)
                if standing == "good":
                    pct_target = random.uniform(0.76, 0.95)
                elif standing == "warning":
                    pct_target = random.uniform(0.60, 0.74)
                else:
                    pct_target = random.uniform(0.40, 0.58)

                attended_cls = max(0, min(total_cls, int(round(total_cls * pct_target))))
                
                log = AttendanceLog(
                    student_id=student.id,
                    subject=subject,
                    total_classes=total_cls,
                    attended_classes=attended_cls
                )
                attendance_logs.append(log)

        session.add_all(attendance_logs)
        session.commit()
        print(f"Created {len(attendance_logs)} Attendance Log Records across {len(SUBJECTS)} subjects.")

        # 3. Seed Policy & Syllabus Documents
        print("Seeding Policy Documents & Vector Embeddings...")
        doc1 = Document(
            title="University Attendance & Minimum Requirement Policy 2026",
            doc_type="policy",
            source_path="/docs/policy_attendance_2026.pdf"
        )
        doc2 = Document(
            title="Academic Grading, Examination & Evaluation Rules",
            doc_type="handbook",
            source_path="/docs/academic_rules_2026.pdf"
        )
        session.add_all([doc1, doc2])
        session.commit()

        policy_chunks = [
            (
                doc1.id,
                "ATTENDANCE MANDATE SECTION 4.1: All registered undergraduate and postgraduate students must maintain a minimum of 75% attendance in every enrolled course to be eligible to sit for end-semester examinations.",
                0
            ),
            (
                doc1.id,
                "MEDICAL CONDONATION & CONDONATION FEE SECTION 4.3: Attendance between 65% and 74.9% may be condoned by the Dean of Academic Affairs upon submission of certified hospital medical certificates within 7 working days of absence, subject to payment of a condonation fee of $50 per subject.",
                1
            ),
            (
                doc1.id,
                "EXAM HALL TICKET DEBARMENT SECTION 4.5: Students with overall attendance falling below 65% in any subject are automatically debarred from taking the end-semester final examination and must re-register for the course in the subsequent semester.",
                2
            ),
            (
                doc2.id,
                "GRADING SYSTEM & GPA SCALE SECTION 2.1: The university operates on a 10-point Letter Grading scale (S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0). A minimum Cumulative Grade Point Average (CGPA) of 5.0 is required for degree award.",
                0
            ),
            (
                doc2.id,
                "RE-EVALUATION & RE-COUNTING PROCEDURE SECTION 5.2: Any student dissatisfied with their end-semester result may apply for re-evaluation within 14 calendar days of result publication via the Academic Portal.",
                1
            ),
        ]

        for doc_id, chunk_text, idx in policy_chunks:
            embedding_vec = get_text_embedding(chunk_text)
            embedding_obj = DocumentEmbedding(
                document_id=doc_id,
                chunk_text=chunk_text,
                embedding=str(embedding_vec),
                chunk_index=idx
            )
            session.add(embedding_obj)

        session.commit()
        print("Realistic Demo Dataset Generation Complete!")

    except Exception as e:
        session.rollback()
        print(f"Error generating demo dataset: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    generate_realistic_dataset()
