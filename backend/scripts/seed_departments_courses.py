import sys
import os
import uuid
from typing import Dict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SyncSessionLocal, sync_engine, Base
from app.db.models import Department, Division, Course, User, FacultyCourseDivision, AttendanceLog, Document, DocumentEmbedding
from app.core.security import hash_password
from app.services.retrieval_service import get_text_embedding


DEPARTMENTS_DATA = [
    {"name": "Computer Engineering", "code": "COMP"},
    {"name": "Artificial Intelligence & Data Science", "code": "AIDS"},
    {"name": "Electronics & Computer Science", "code": "ECS"},
    {"name": "Mechanical Engineering", "code": "MECH"}
]

DIVISIONS_DATA = [
    {"dept_code": "COMP", "name": "A", "semester": 5, "student_count": 70},
    {"dept_code": "COMP", "name": "B", "semester": 5, "student_count": 70},
    {"dept_code": "AIDS", "name": "A", "semester": 5, "student_count": 60},
    {"dept_code": "ECS", "name": "A", "semester": 5, "student_count": 60},
    {"dept_code": "MECH", "name": "A", "semester": 5, "student_count": 50}
]

COURSES_DATA = [
    # Computer Engineering
    {"dept_code": "COMP", "name": "Computer Networks", "code": "25PCC13CE11", "semester": 5},
    {"dept_code": "COMP", "name": "Theory of Computer Science and Compiler Construction", "code": "25PCC13CE12", "semester": 5},
    {"dept_code": "COMP", "name": "Operating System with System Programming", "code": "25PCC13CE13", "semester": 5},
    {"dept_code": "COMP", "name": "Data Warehousing and Mining", "code": "25PCC13CE14", "semester": 5},
    {"dept_code": "COMP", "name": "Distributed Computing", "code": "25PCC13CE15", "semester": 6},
    {"dept_code": "COMP", "name": "Software Engineering", "code": "25PCC13CE16", "semester": 6},
    {"dept_code": "COMP", "name": "Artificial Intelligence Lab", "code": "25PCC13CE17", "semester": 6},
    {"dept_code": "COMP", "name": "Cryptography and System Security", "code": "25PCC13CE19", "semester": 6},
    {"dept_code": "COMP", "name": "Competitive Coding", "code": "25PCC13CE20", "semester": 6},

    # AI & Data Science
    {"dept_code": "AIDS", "name": "Operating System", "code": "25PCC13CS11", "semester": 5},
    {"dept_code": "AIDS", "name": "Computer Network", "code": "25PCC13CS12", "semester": 5},
    {"dept_code": "AIDS", "name": "Artificial Intelligence", "code": "25PCC13CS13", "semester": 5},
    {"dept_code": "AIDS", "name": "Machine Learning", "code": "25PCC13CS14", "semester": 5},
    {"dept_code": "AIDS", "name": "Theoretical Computer Science", "code": "25PCC13CS15", "semester": 5},
    {"dept_code": "AIDS", "name": "Cryptography and Computer Security", "code": "25PCC13CS16", "semester": 6},
    {"dept_code": "AIDS", "name": "Data Warehousing and Mining", "code": "25PCC13CS17", "semester": 6},
    {"dept_code": "AIDS", "name": "Cloud Computing", "code": "25PCC13CS18", "semester": 6},
    {"dept_code": "AIDS", "name": "Deep Learning", "code": "25PCC13CS19", "semester": 6},
    {"dept_code": "AIDS", "name": "Software Testing Lab", "code": "25PCC13CS20", "semester": 6},

    # Electronics & Computer Science
    {"dept_code": "ECS", "name": "Control Systems", "code": "25PCC13EC11", "semester": 5},
    {"dept_code": "ECS", "name": "Computer Networks", "code": "25PCC13EC12", "semester": 5},
    {"dept_code": "ECS", "name": "Artificial Intelligence", "code": "25PCC13EC13", "semester": 5},
    {"dept_code": "ECS", "name": "Analysis of Algorithms", "code": "25PCC13EC14", "semester": 5},
    {"dept_code": "ECS", "name": "Data Warehousing and Mining", "code": "25PCC13EC15", "semester": 5},
    {"dept_code": "ECS", "name": "VLSI Design", "code": "25PCC13EC16", "semester": 6},
    {"dept_code": "ECS", "name": "Analog and Digital Communication", "code": "25PCC13EC17", "semester": 6},
    {"dept_code": "ECS", "name": "Machine Learning", "code": "25PCC13EC18", "semester": 6},
    {"dept_code": "ECS", "name": "CAD for VLSI", "code": "25PCC13EC19", "semester": 6},
    {"dept_code": "ECS", "name": "System Security", "code": "25PCC13EC20", "semester": 6},
    {"dept_code": "ECS", "name": "Cloud Computing", "code": "25OEEC41", "semester": 6},

    # Mechanical Engineering
    {"dept_code": "MECH", "name": "Applied Thermodynamics", "code": "25PCC13ME11", "semester": 5},
    {"dept_code": "MECH", "name": "Theory of Machines", "code": "25PCC13ME12", "semester": 5},
    {"dept_code": "MECH", "name": "Metrology and Quality Engineering", "code": "25PCC13ME13", "semester": 5},
    {"dept_code": "MECH", "name": "CAD/CAM and FEA", "code": "25PCC13ME14", "semester": 5},
    {"dept_code": "MECH", "name": "FEA and CFD Lab", "code": "25PCC13ME15", "semester": 5},
    {"dept_code": "MECH", "name": "Fluid Mechanics & Hydraulic Machines", "code": "25PCC13ME16", "semester": 6},
    {"dept_code": "MECH", "name": "Machine Design", "code": "25PCC13ME17", "semester": 6},
    {"dept_code": "MECH", "name": "Fluid Mechanics & Hydraulic Machines Lab", "code": "25PCC13ME18", "semester": 6},
    {"dept_code": "MECH", "name": "Hydraulics and Pneumatics Lab", "code": "25PCC13ME19", "semester": 6},
    {"dept_code": "MECH", "name": "Measurements and Systems Lab", "code": "25VSEL3MF04", "semester": 6},
    {"dept_code": "MECH", "name": "CNC Lab", "code": "25VSE13ME05", "semester": 6}
]

FACULTY_NAMES_BY_DEPT = {
    "COMP": [
        ("Prof. David Vance", "faculty@academic.edu"),
        ("Dr. Alan Turing", "alan.turing@academic.edu"),
        ("Prof. Grace Hopper", "grace.hopper@academic.edu"),
        ("Dr. Barbara Liskov", "barbara.liskov@academic.edu"),
        ("Prof. Donald Knuth", "donald.knuth@academic.edu"),
        ("Dr. Ken Thompson", "ken.thompson@academic.edu"),
        ("Prof. Dennis Ritchie", "dennis.ritchie@academic.edu")
    ],
    "AIDS": [
        ("Dr. Geoffrey Hinton", "geoffrey.hinton@academic.edu"),
        ("Prof. Yann LeCun", "yann.lecun@academic.edu"),
        ("Dr. Andrew Ng", "andrew.ng@academic.edu"),
        ("Prof. Fei-Fei Li", "feifei.li@academic.edu"),
        ("Dr. Yoshua Bengio", "yoshua.bengio@academic.edu"),
        ("Prof. Demis Hassabis", "demis.hassabis@academic.edu")
    ],
    "ECS": [
        ("Dr. Claude Shannon", "claude.shannon@academic.edu"),
        ("Prof. Jack Kilby", "jack.kilby@academic.edu"),
        ("Dr. Robert Noyce", "robert.noyce@academic.edu"),
        ("Prof. Gordon Moore", "gordon.moore@academic.edu"),
        ("Dr. Federico Faggin", "federico.faggin@academic.edu"),
        ("Prof. Nikola Tesla", "nikola.tesla@academic.edu")
    ],
    "MECH": [
        ("Dr. James Watt", "james.watt@academic.edu"),
        ("Prof. Nikolaus Otto", "nikolaus.otto@academic.edu"),
        ("Dr. Rudolf Diesel", "rudolf.diesel@academic.edu"),
        ("Prof. Ludwig Prandtl", "ludwig.prandtl@academic.edu"),
        ("Dr. Osborne Reynolds", "osborne.reynolds@academic.edu"),
        ("Prof. Sadi Carnot", "sadi.carnot@academic.edu")
    ]
}


def seed_departments_and_courses():
    print("Dropping and Re-creating Database Tables...")
    Base.metadata.drop_all(bind=sync_engine)
    Base.metadata.create_all(bind=sync_engine)

    session = SyncSessionLocal()
    try:
        # Clear existing structure
        session.query(FacultyCourseDivision).delete()
        session.query(AttendanceLog).delete()
        session.query(DocumentEmbedding).delete()
        session.query(Document).delete()
        session.query(User).delete()
        session.query(Course).delete()
        session.query(Division).delete()
        session.query(Department).delete()
        session.commit()

        # 1. Insert Departments
        dept_map: Dict[str, Department] = {}
        for d in DEPARTMENTS_DATA:
            dept = Department(name=d["name"], code=d["code"])
            session.add(dept)
            dept_map[d["code"]] = dept

        session.commit()
        print(f"Created {len(dept_map)} Departments.")

        # 2. Insert Divisions
        div_map: Dict[str, Division] = {}
        for div in DIVISIONS_DATA:
            d_obj = dept_map[div["dept_code"]]
            division = Division(
                department_id=d_obj.id,
                name=div["name"],
                semester=div["semester"],
                student_count=div["student_count"]
            )
            session.add(division)
            div_key = f"{div['dept_code']}-{div['name']}"
            div_map[div_key] = division

        session.commit()
        print(f"Created {len(div_map)} Divisions (COMP-A, COMP-B, AIDS-A, ECS-A, MECH-A).")

        # 3. Insert Courses
        course_map: Dict[str, Course] = {}
        for c in COURSES_DATA:
            d_obj = dept_map[c["dept_code"]]
            course = Course(
                department_id=d_obj.id,
                name=c["name"],
                code=c["code"],
                semester=c["semester"]
            )
            session.add(course)
            course_map[c["code"]] = course

        session.commit()
        print(f"Created {len(course_map)} Department-Scoped Courses.")

        # 4. Insert Department-Scoped Faculty
        faculty_users = []
        for dept_code, fac_list in FACULTY_NAMES_BY_DEPT.items():
            d_obj = dept_map[dept_code]
            for idx, (name, email) in enumerate(fac_list):
                # Ensure primary demo faculty is faculty@academic.edu
                fac_id = uuid.UUID("00000000-0000-0000-0000-000000000003") if email == "faculty@academic.edu" else uuid.uuid4()
                fac_user = User(
                    id=fac_id,
                    email=email,
                    hashed_password=hash_password("faculty123"),
                    full_name=name,
                    role="FACULTY",
                    department_id=d_obj.id
                )
                session.add(fac_user)
                faculty_users.append((dept_code, fac_user))

        session.commit()
        print(f"Created {len(faculty_users)} Department-Scoped Faculty Members.")

        # 5. Assign Faculty to Courses & Divisions within their department
        assignments = []
        for dept_code in ["COMP", "AIDS", "ECS", "MECH"]:
            dept_fac = [f for code, f in faculty_users if code == dept_code]
            dept_courses = [c for c in COURSES_DATA if c["dept_code"] == dept_code]
            dept_divs = [div for key, div in div_map.items() if key.startswith(dept_code)]

            for c_idx, c_info in enumerate(dept_courses):
                c_obj = course_map[c_info["code"]]
                assigned_fac = dept_fac[c_idx % len(dept_fac)]
                for div_obj in dept_divs:
                    fcd = FacultyCourseDivision(
                        faculty_id=assigned_fac.id,
                        course_id=c_obj.id,
                        division_id=div_obj.id
                    )
                    assignments.append(fcd)

        session.add_all(assignments)
        session.commit()
        print(f"Created {len(assignments)} Faculty-Course-Division Assignments.")

        # 6. Seed Department-Scoped Course Syllabus Documents & Vectors
        print("Seeding Syllabus Documents for Colliding Courses...")

        syllabus_docs = [
            ("COMP", "25PCC13CE11", "COMP Computer Networks Syllabus (25PCC13CE11)",
             "COMP Computer Networks 25PCC13CE11 Syllabus: Focuses on TCP/IP protocol suite, Ethernet framing, Socket Programming, BGP Routing, and Wireshark Packet Analysis for Computer Engineering."),

            ("AIDS", "25PCC13CS12", "AIDS Computer Network Syllabus (25PCC13CS12)",
             "AIDS Computer Network 25PCC13CS12 Syllabus: Focuses on Distributed Network Architectures, Network Data Engineering, REST APIs, HTTP/3, and Packet Analysis for AI & Data Science."),

            ("ECS", "25PCC13EC12", "ECS Computer Networks Syllabus (25PCC13EC12)",
             "ECS Computer Networks 25PCC13EC12 Syllabus: Focuses on Embedded Hardware Interfaces, Physical Layer Protocols, CAN Bus, Zigbee, IoT Networking, and Microcontroller Network Drivers for Electronics & Computer Science."),

            ("COMP", "25PCC13CE14", "COMP Data Warehousing & Mining Syllabus (25PCC13CE14)",
             "COMP Data Warehousing and Mining 25PCC13CE14 Syllabus: Covers Star Schema, Snowflake Schema, OLAP Cubes, Apriori Algorithm, and Decision Trees for Computer Engineering."),

            ("AIDS", "25PCC13CS17", "AIDS Data Warehousing & Mining Syllabus (25PCC13CS17)",
             "AIDS Data Warehousing and Mining 25PCC13CS17 Syllabus: Covers Big Data Mining, Spark DataFrames, Feature Engineering, K-Means Clustering, and Neural Embedding Mining for AI & Data Science."),

            ("ECS", "25PCC13EC15", "ECS Data Warehousing & Mining Syllabus (25PCC13EC15)",
             "ECS Data Warehousing and Mining 25PCC13EC15 Syllabus: Covers FPGA Data Acceleration, Hardware Data Mining Pipelines, Sensor Data Warehousing, and Real-time Signal Mining for Electronics."),

            ("AIDS", "25PCC13CS13", "AIDS Artificial Intelligence Syllabus (25PCC13CS13)",
             "AIDS Artificial Intelligence 25PCC13CS13 Syllabus: Covers A* Search, Knowledge Representation, Heuristic Reasoning, Genetic Algorithms, and Probabilistic AI for AI & Data Science."),

            ("ECS", "25PCC13EC13", "ECS Artificial Intelligence Syllabus (25PCC13EC13)",
             "ECS Artificial Intelligence 25PCC13EC13 Syllabus: Covers Edge AI, Neuromorphic Chips, Embedded AI Inference, Hardware Neural Accelerators, and Robotics Control for ECS."),

            ("AIDS", "25PCC13CS14", "AIDS Machine Learning Syllabus (25PCC13CS14)",
             "AIDS Machine Learning 25PCC13CS14 Syllabus: Covers Linear/Logistic Regression, Support Vector Machines, Gradient Boosting, XGBoost, and Model Optimization for AI & Data Science."),

            ("ECS", "25PCC13EC18", "ECS Machine Learning Syllabus (25PCC13EC18)",
             "ECS Machine Learning 25PCC13EC18 Syllabus: Covers TinyML, Microcontroller ML Deployment, Quantized Neural Networks, Sensor Signal Classification, and ARM Cortex ML for ECS."),

            ("COMP", "25PCC13CE19", "COMP Cryptography and System Security Syllabus (25PCC13CE19)",
             "COMP Cryptography and System Security 25PCC13CE19 Syllabus: Covers AES-256, RSA, Elliptic Curve Cryptography, Buffer Overflow Exploits, Kernel Security, and Firewalls for Computer Engineering."),

            ("AIDS", "25PCC13CS16", "AIDS Cryptography and Computer Security Syllabus (25PCC13CS16)",
             "AIDS Cryptography and Computer Security 25PCC13CS16 Syllabus: Covers Adversarial Machine Learning, Model Poisoning Security, Differential Privacy, Data Encryption, and Secure Multi-party Computation for AI & Data Science."),

            ("ECS", "25PCC13EC20", "ECS System Security Syllabus (25PCC13EC20)",
             "ECS System Security 25PCC13EC20 Syllabus: Covers Hardware Security Modules (HSM), Side-Channel Attacks, Firmware Security, Secure Boot, and TrustZone for Electronics & Computer Science."),

            ("AIDS", "25PCC13CS18", "AIDS Cloud Computing Syllabus (25PCC13CS18)",
             "AIDS Cloud Computing 25PCC13CS18 Syllabus: Covers AWS/GCP AI Pipelines, Docker Containers, Kubernetes Cluster Management, Serverless Inference, and Distributed Cloud Storage for AI & Data Science."),

            ("ECS", "25OEEC41", "ECS Cloud Computing Syllabus (25OEEC41)",
             "ECS Cloud Computing Open Elective 25OEEC41 Syllabus: Covers IoT Cloud Portals, Edge-to-Cloud Middleware, MQTT Protocol, Cloud Data Ingestion, and Remote Device Management for Electronics.")
        ]

        for dept_code, course_code, title, chunk_text in syllabus_docs:
            d_obj = dept_map[dept_code]
            c_obj = course_map[course_code]

            doc = Document(
                department_id=d_obj.id,
                course_id=c_obj.id,
                title=title,
                doc_type="syllabus",
                source_path=f"/docs/{course_code}_syllabus.pdf"
            )
            session.add(doc)
            session.commit()

            vec = get_text_embedding(chunk_text)
            embedding_obj = DocumentEmbedding(
                document_id=doc.id,
                chunk_text=chunk_text,
                embedding=str(vec),
                chunk_index=0
            )
            session.add(embedding_obj)

        session.commit()
        print("Seeded Department-Scoped Syllabus Documents & Vector Embeddings.")

    except Exception as e:
        session.rollback()
        print(f"Error seeding structure: {e}")
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    seed_departments_and_courses()
