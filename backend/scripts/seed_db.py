import sys
import os
import uuid
from datetime import datetime

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal, sync_engine, Base
from app.db.models import User, AttendanceLog, Document, DocumentEmbedding
from app.core.security import hash_password
from app.services.retrieval_service import get_text_embedding


def ensure_database_exists():
    from app.core.config import settings
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    try:
        conn = psycopg2.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.EFFECTIVE_POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            dbname="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}'")
        exists = cursor.fetchone()
        if not exists:
            print(f"Creating database '{settings.POSTGRES_DB}'...")
            cursor.execute(f"CREATE DATABASE {settings.POSTGRES_DB};")
            print(f"Database '{settings.POSTGRES_DB}' created successfully.")
        cursor.close()
        conn.close()

        # Connect to smart_academic_db and enable vector extension
        conn2 = psycopg2.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.EFFECTIVE_POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            dbname=settings.POSTGRES_DB
        )
        conn2.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor2 = conn2.cursor()
        try:
            cursor2.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            print("Extension 'vector' enabled successfully.")
        except Exception as ext_err:
            print(f"[Notice] Vector extension enable warning: {ext_err}")
        cursor2.close()
        conn2.close()
    except Exception as e:
        print(f"[Notice] Auto-database check skipped: {e}")


def seed_database():
    ensure_database_exists()
    print("Creating tables (if not existing)...")
    Base.metadata.create_all(bind=sync_engine)

    session = SyncSessionLocal()
    try:
        # 1. Check if seed users exist
        existing_student = session.query(User).filter_by(email="student@academic.edu").first()
        if existing_student:
            print("Database already seeded with demo data!")
            return

        print("Seeding Demo Users...")
        # Demo Student
        demo_student_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        demo_student = User(
            id=demo_student_id,
            email="student@academic.edu",
            hashed_password=hash_password("student123"),
            full_name="Alex Mercer",
            role="STUDENT"
        )
        session.add(demo_student)

        # Additional Demo Student (At Risk)
        student2_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
        student2 = User(
            id=student2_id,
            email="sarah@academic.edu",
            hashed_password=hash_password("sarah123"),
            full_name="Sarah Jenkins",
            role="STUDENT"
        )
        session.add(student2)

        # Demo Faculty
        demo_faculty = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
            email="faculty@academic.edu",
            hashed_password=hash_password("faculty123"),
            full_name="Prof. David Vance",
            role="FACULTY"
        )
        session.add(demo_faculty)

        session.commit()
        print("Demo Users Created Successfully.")

        # 2. Seed Attendance Logs for Alex Mercer (Demo Student)
        print("Seeding Attendance Logs...")
        attendance_records = [
            # Data Structures: 14/20 = 70.0% (AT RISK)
            AttendanceLog(student_id=demo_student_id, subject="Data Structures & Algorithms", total_classes=20, attended_classes=14),
            # Operating Systems: 18/20 = 90.0% (OK)
            AttendanceLog(student_id=demo_student_id, subject="Operating Systems", total_classes=20, attended_classes=18),
            # Database Management Systems: 13/20 = 65.0% (AT RISK)
            AttendanceLog(student_id=demo_student_id, subject="Database Management Systems", total_classes=20, attended_classes=13),
            # Computer Networks: 16/20 = 80.0% (OK)
            AttendanceLog(student_id=demo_student_id, subject="Computer Networks", total_classes=20, attended_classes=16),
            
            # Attendance for Sarah Jenkins (Student 2)
            AttendanceLog(student_id=student2_id, subject="Data Structures & Algorithms", total_classes=20, attended_classes=12),
            AttendanceLog(student_id=student2_id, subject="Operating Systems", total_classes=20, attended_classes=15),
            AttendanceLog(student_id=student2_id, subject="Database Management Systems", total_classes=20, attended_classes=11),
            AttendanceLog(student_id=student2_id, subject="Computer Networks", total_classes=20, attended_classes=17),
        ]
        session.add_all(attendance_records)

        # 3. Seed Sample Academic Policy Documents & Embeddings
        print("Seeding Sample Academic Policies & Embeddings...")
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

        # Document Chunks
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
                embedding=embedding_vec,
                chunk_index=idx
            )
            session.add(embedding_obj)

        session.commit()
        print("Database Seed Completed Successfully!")

    except Exception as e:
        session.rollback()
        print(f"Error seeding database: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    seed_database()
