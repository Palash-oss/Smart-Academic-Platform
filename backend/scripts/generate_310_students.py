import sys
import os
import uuid
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal, sync_engine
from app.db.models import Department, Division, Course, User, AttendanceLog
from app.core.security import hash_password

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    fake = None


DEMO_STUDENTS = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
        "email": "student@academic.edu",
        "full_name": "Alex Mercer",
        "dept_code": "COMP",
        "div_name": "A",
        "performance": "high"
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "aids.student@academic.edu",
        "full_name": "Sarah Jenkins",
        "dept_code": "AIDS",
        "div_name": "A",
        "performance": "at_risk"
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000004"),
        "email": "ecs.student@academic.edu",
        "full_name": "Marcus Chen",
        "dept_code": "ECS",
        "div_name": "A",
        "performance": "borderline"
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000005"),
        "email": "mech.student@academic.edu",
        "full_name": "David Kim",
        "dept_code": "MECH",
        "div_name": "A",
        "performance": "at_risk"
    }
]


FIRST_NAMES = [
    "Liam", "Noah", "Oliver", "Elijah", "James", "William", "Benjamin", "Lucas", "Henry", "Alexander",
    "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan", "Jackson", "Levi", "Sebastian", "Mateo",
    "Jack", "Owen", "Theodore", "Aiden", "Samuel", "Joseph", "John", "David", "Wyatt", "Matthew",
    "Luke", "Julian", "Hudson", "Grayson", "Leo", "Jayden", "Gabriel", "Isaac", "Lincoln", "Anthony",
    "Emma", "Olivia", "Ava", "Sophia", "Isabella", "Charlotte", "Amelia", "Mia", "Harper", "Evelyn",
    "Abigail", "Emily", "Ella", "Elizabeth", "Camila", "Luna", "Sofia", "Avery", "Mila", "Aria",
    "Scarlett", "Penelope", "Layla", "Chloe", "Victoria", "Madison", "Eleanor", "Grace", "Nora", "Riley",
    "Aarav", "Vihaan", "Aditya", "Sai", "Reyansh", "Ananya", "Diya", "Priya", "Riya", "Kavya",
    "Rohan", "Dev", "Arjun", "Kabir", "Karan", "Siddharth", "Ishaan", "Neha", "Pooja", "Sneha",
    "Chen", "Wei", "Ming", "Ying", "Jing", "Tao", "Xiu", "Jun", "Zhe", "Hao",
    "Carlos", "Mateo", "Sofia", "Isabella", "Elena", "Diego", "Javier", "Carmen", "Lucia", "Fernando"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Sharma", "Patel", "Verma", "Gupta", "Singh", "Rao", "Nair", "Joshi", "Kulkarni", "Deshmukh",
    "Mehta", "Agarwal", "Bhatia", "Reddy", "Chowdhury", "Mukherjee", "Banerjee", "Kapoor", "Malhotra", "Saxena",
    "Zhang", "Wang", "Li", "Liu", "Yang", "Huang", "Wu", "Zhou", "Xu", "Sun",
    "Silva", "Santos", "Ferreira", "Dubois", "Lefebvre", "Moreau", "Laurent", "Girard", "Roux", "Fournier"
]


def generate_unique_name(used_names_set):
    """Generates a guaranteed unique realistic full name."""
    if fake:
        for _ in range(500):
            fn = fake.first_name()
            ln = fake.last_name()
            full = f"{fn} {ln}"
            if full not in used_names_set:
                used_names_set.add(full)
                return full

    while True:
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        full = f"{fn} {ln}"
        if full not in used_names_set:
            used_names_set.add(full)
            return full


def generate_310_students_and_attendance():
    session = SyncSessionLocal()
    try:
        print("\n" + "="*80)
        print("GENERATING 310 UNIQUE STUDENTS ACROSS 5 DIVISIONS WITH HISTORICAL ATTENDANCE")
        print("="*80)

        # Clear existing students and attendance logs
        session.query(AttendanceLog).delete()
        session.query(User).filter(User.role == "STUDENT").delete()
        session.commit()

        # Load departments and divisions
        dept_map = {d.code: d for d in session.query(Department).all()}
        div_map = {f"{d.department.code}-{d.name}": d for d in session.query(Division).join(Department).all()}
        courses_by_dept = {}
        for d_code, d_obj in dept_map.items():
            courses_by_dept[d_code] = session.query(Course).filter(Course.department_id == d_obj.id).all()

        div_target_counts = {
            "COMP-A": 70,
            "COMP-B": 70,
            "AIDS-A": 60,
            "ECS-A": 60,
            "MECH-A": 50
        }

        used_names = set()
        all_created_students = []

        # Precompute bcrypt hash once for 310 users
        default_pwd_hash = hash_password("student123")

        # 1. Add demo students first
        for demo in DEMO_STUDENTS:
            d_obj = dept_map[demo["dept_code"]]
            div_obj = div_map[f"{demo['dept_code']}-{demo['div_name']}"]
            used_names.add(demo["full_name"])

            student = User(
                id=demo["id"],
                email=demo["email"],
                hashed_password=default_pwd_hash,
                full_name=demo["full_name"],
                role="STUDENT",
                department_id=d_obj.id,
                division_id=div_obj.id
            )
            session.add(student)
            all_created_students.append((student, demo["dept_code"], demo["performance"]))

        session.commit()

        # 2. Generate remaining unique students for each division
        for div_key, total_needed in div_target_counts.items():
            dept_code, div_name = div_key.split("-")
            d_obj = dept_map[dept_code]
            div_obj = div_map[div_key]

            existing_count = sum(1 for demo in DEMO_STUDENTS if f"{demo['dept_code']}-{demo['div_name']}" == div_key)
            needed = total_needed - existing_count

            print(f"Generating {needed} unique student names for Division {div_key} (Capacity: {total_needed})...")

            for i in range(1, needed + 1):
                full_name = generate_unique_name(used_names)
                # Create clean unique email
                clean_name = full_name.lower().replace(" ", ".").replace("'", "")
                email = f"{clean_name}.{i}@{dept_code.lower()}.academic.edu"

                rand_val = random.random()
                if rand_val < 0.60:
                    perf = "high"
                elif rand_val < 0.85:
                    perf = "borderline"
                else:
                    perf = "at_risk"

                student = User(
                    email=email,
                    hashed_password=default_pwd_hash,
                    full_name=full_name,
                    role="STUDENT",
                    department_id=d_obj.id,
                    division_id=div_obj.id
                )
                session.add(student)
                all_created_students.append((student, dept_code, perf))

        session.commit()
        print(f"Successfully Created {len(all_created_students)} Unique Student Accounts in Postgres.")

        # 3. Seed 6-8 Weeks Historical Attendance Logs for ALL 310 Students across their Department's Courses
        print("\nSeeding 6-8 Weeks Historical Attendance Logs across all department courses...")
        logs_to_insert = []

        for student, dept_code, perf in all_created_students:
            dept_courses = courses_by_dept[dept_code]

            for course in dept_courses:
                total_cls = random.randint(24, 32)

                if perf == "high":
                    target_pct = random.uniform(0.80, 0.96)
                elif perf == "borderline":
                    target_pct = random.uniform(0.70, 0.749)
                else:  # at_risk
                    target_pct = random.uniform(0.40, 0.64)

                attended_cls = max(0, min(total_cls, int(round(total_cls * target_pct))))

                log = AttendanceLog(
                    student_id=student.id,
                    course_id=course.id,
                    subject=f"{course.name} ({course.code})",
                    total_classes=total_cls,
                    attended_classes=attended_cls
                )
                logs_to_insert.append(log)

        session.add_all(logs_to_insert)
        session.commit()
        print(f"Successfully Created {len(logs_to_insert)} Attendance Log Records across {len(all_created_students)} Students!")

        print("\n" + "="*80)
        print("SUMMARY VERIFICATION:")
        print("="*80)
        for div_key, div_obj in div_map.items():
            count = session.query(User).filter(User.division_id == div_obj.id, User.role == "STUDENT").count()
            print(f"Division {div_key:<8} | Actual Enrolled Students in DB: {count}")

        total_students_in_db = session.query(User).filter(User.role == "STUDENT").count()
        total_unique_names = len({st.full_name for st, _, _ in all_created_students})
        print(f"\nGRAND TOTAL STUDENTS IN DB: {total_students_in_db} / 310")
        print(f"UNIQUE FULL NAMES IN DB: {total_unique_names} / {total_students_in_db}")
        print("="*80 + "\n")

    except Exception as e:
        session.rollback()
        print(f"Error seeding 310 students: {e}")
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    generate_310_students_and_attendance()
