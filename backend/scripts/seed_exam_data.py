"""
Seed syllabus Course Outcomes (COs) and CO-PO Articulation Matrices
from TE_11thAug26.pdf (FRCRCE-3-26 scheme) into Neon PostgreSQL.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import Course, CourseOutcome, CourseCOPOMapping

SYLLABUS_CO_DATA = {
    "25PCC13CE19": {
        "outcomes": [
            ("CO1", "Apply concepts of modular arithmetic and number theory to classical encryption techniques to achieve system security goals.", "Apply"),
            ("CO2", "Apply modern symmetric and asymmetric cryptographic techniques to solve security problems.", "Apply"),
            ("CO3", "Analyze cryptographic hash functions and message authentication mechanisms for ensuring data integrity.", "Analyze"),
            ("CO4", "Analyze digital signature schemes and authentication protocols for secure communication.", "Analyze"),
            ("CO5", "Analyze network attacks and security protocols to evaluate system vulnerabilities.", "Analyze"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 2, "PO4": 1, "PO5": 3, "PO7": 1, "PO8": 2, "PO11": 2, "PSO2": 3},
            "CO2": {"PO1": 3, "PO2": 3, "PO4": 1, "PO5": 2, "PO7": 1, "PO8": 2, "PO11": 2, "PSO2": 3},
            "CO3": {"PO1": 2, "PO2": 2, "PO4": 2, "PO5": 2, "PO7": 1, "PO8": 2, "PO11": 2, "PSO2": 3},
            "CO4": {"PO1": 2, "PO2": 2, "PO4": 1, "PO5": 2, "PO7": 2, "PO8": 2, "PO11": 2, "PSO2": 3},
            "CO5": {"PO1": 2, "PO2": 2, "PO4": 2, "PO5": 2, "PO7": 1, "PO8": 2, "PO11": 2, "PSO2": 3},
        }
    },
    "25PCC13CE21": {
        "outcomes": [
            ("CO1", "Design deterministic and non-deterministic finite automata to recognize formal languages.", "Apply"),
            ("CO2", "Construct regular expressions and establish their equivalence with finite automata.", "Apply"),
            ("CO3", "Develop context-free grammars for formal languages and convert them into Chomsky and Greibach Normal Forms.", "Apply"),
            ("CO4", "Design Pushdown Automata and Turing Machines for language recognition and computation.", "Apply"),
            ("CO5", "Analyze computational problems using the concepts of decidability and undecidability.", "Analyze"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 3, "PO3": 2, "PO12": 2, "PSO1": 2, "PSO2": 1},
            "CO2": {"PO1": 3, "PO2": 3, "PO3": 2, "PO12": 2, "PSO1": 2, "PSO2": 1},
            "CO3": {"PO1": 3, "PO2": 3, "PO3": 2, "PO12": 2, "PSO1": 2, "PSO2": 1},
            "CO4": {"PO1": 3, "PO2": 3, "PO3": 3, "PO12": 2, "PSO1": 2, "PSO2": 1},
            "CO5": {"PO1": 3, "PO2": 3, "PO4": 2, "PO12": 2, "PSO1": 2, "PSO2": 1},
        }
    },
    "25PCC13CE22": {
        "outcomes": [
            ("CO1", "Analyze the impact of transmission media, devices, and switching techniques on computer networks.", "Analyze"),
            ("CO2", "Apply the knowledge of various functionalities of MAC & LLC sublayer.", "Apply"),
            ("CO3", "Classify Functionalities of static & dynamic routing protocol.", "Understand"),
            ("CO4", "Analyze Transport layer protocols and its impact on quality of service.", "Analyze"),
            ("CO5", "Design network architecture using various network protocols in real time environment.", "Create"),
            ("CO6", "Evaluate performance parameters and troubleshoot enterprise network protocols.", "Evaluate"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PSO2": 1},
            "CO2": {"PO1": 3, "PO2": 3, "PO3": 3, "PO5": 2, "PO10": 2, "PSO2": 1},
            "CO3": {"PO1": 3, "PO2": 3, "PO3": 3, "PO5": 2, "PO10": 3, "PSO2": 1},
            "CO4": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 3, "PO5": 2, "PO10": 3, "PSO2": 1},
            "CO5": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 3, "PO5": 1, "PO10": 3, "PSO2": 1},
            "CO6": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 3, "PO5": 3, "PO6": 3, "PO10": 3, "PSO2": 1},
        }
    },
    "25PCC13CE14": {
        "outcomes": [
            ("CO1", "Design and develop appropriate dimensional models for a given real-world case study using tools.", "Apply"),
            ("CO2", "Apply and interpret various OLAP operations on multidimensional datasets using tools.", "Apply"),
            ("CO3", "Analyze datasets and apply suitable data preprocessing techniques such as cleaning, transformation, reduction, and discretization.", "Analyze"),
            ("CO4", "Apply classification, clustering, and association rule mining algorithms on real-world datasets.", "Apply"),
            ("CO5", "Evaluate classification, clustering, and association algorithms using appropriate performance metrics and validation techniques.", "Evaluate"),
            ("CO6", "Explain Web Mining concepts and techniques, including Web Content, Structure, and Usage Mining.", "Understand"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 2, "PO3": 3, "PO5": 2, "PO6": 1, "PO8": 1, "PO9": 1, "PO11": 1, "PSO1": 2, "PSO2": 1},
            "CO2": {"PO1": 2, "PO2": 2, "PO4": 1, "PO5": 3, "PO8": 1, "PO11": 1, "PSO1": 2},
            "CO3": {"PO1": 2, "PO2": 3, "PO4": 3, "PO5": 2, "PO6": 1, "PO11": 1, "PSO1": 3, "PSO2": 1},
            "CO4": {"PO1": 3, "PO2": 3, "PO3": 2, "PO4": 2, "PO5": 3, "PO6": 1, "PO8": 1, "PO11": 1, "PSO1": 3, "PSO2": 1},
            "CO5": {"PO1": 2, "PO2": 3, "PO3": 1, "PO4": 2, "PO5": 2, "PO6": 1, "PO9": 1, "PO11": 2, "PSO1": 3},
            "CO6": {"PO1": 2, "PO2": 1, "PO5": 1, "PO6": 1, "PO7": 1, "PO9": 2, "PO11": 1, "PSO1": 1, "PSO2": 2},
        }
    },
    "25VSE13CE04": {
        "outcomes": [
            ("CO1", "Analyze cloud computing service models and develop real-world web applications for deployment on commercial cloud platforms.", "Analyze"),
            ("CO2", "Apply various virtualization techniques in practical scenarios.", "Apply"),
            ("CO3", "Create and deploy real-world web applications on commercial cloud platforms.", "Create"),
            ("CO4", "Implement serverless solutions with messaging services like AWS Lambda, SQS, and SNS for event-driven architectures.", "Apply"),
            ("CO5", "Apply key security mechanisms in the cloud and propose solutions to mitigate associated challenges.", "Apply"),
            ("CO6", "Apply the principles of containerization to practical implementations.", "Apply"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 2, "PO3": 3, "PO5": 3, "PO6": 3, "PO7": 1, "PO8": 2, "PO9": 1, "PO10": 2, "PO11": 1, "PSO1": 2, "PSO2": 1},
            "CO2": {"PO1": 3, "PO2": 1, "PO3": 1, "PO5": 3, "PO7": 1, "PO9": 1, "PO10": 1, "PSO1": 1, "PSO2": 1},
            "CO3": {"PO1": 3, "PO2": 2, "PO3": 3, "PO5": 3, "PO6": 3, "PO7": 1, "PO9": 1, "PO10": 1, "PSO1": 2, "PSO2": 1},
            "CO4": {"PO1": 3, "PO2": 2, "PO3": 3, "PO5": 3, "PO6": 3, "PO7": 1, "PO9": 1, "PO10": 1, "PSO1": 2, "PSO2": 1},
            "CO5": {"PO1": 3, "PO2": 2, "PO3": 3, "PO5": 3, "PO6": 3, "PO7": 1, "PO8": 2, "PO9": 1, "PO10": 1, "PSO1": 1, "PSO2": 3},
            "CO6": {"PO1": 3, "PO2": 2, "PO3": 3, "PO5": 3, "PO6": 3, "PO7": 1, "PO8": 1, "PO9": 1, "PO10": 1, "PSO1": 2, "PSO2": 1},
        }
    },
    "25PEC13CE11": {
        "outcomes": [
            ("CO1", "Describe Blockchain concepts in the context of distributed ledger.", "Understand"),
            ("CO2", "Analyze concepts of cryptocurrencies, consensus algorithms and mining with security of blockchain.", "Analyze"),
            ("CO3", "Illustrate Ethereum architecture and transaction workflow.", "Understand"),
            ("CO4", "Apply the concepts of smart contract using Solidity programming for a given application.", "Apply"),
            ("CO5", "Apply Hyperledger Fabric architecture for enterprise blockchain solutions.", "Apply"),
            ("CO6", "Design blockchain-based solutions for real-world applications.", "Create"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 2, "PO5": 1, "PO6": 1, "PO11": 1, "PSO1": 1, "PSO2": 2},
            "CO2": {"PO1": 3, "PO2": 3, "PO4": 1, "PO5": 1, "PO6": 1, "PO7": 1, "PO11": 1, "PSO1": 1, "PSO2": 2},
            "CO3": {"PO1": 3, "PO2": 2, "PO3": 1, "PO4": 1, "PO5": 3, "PO11": 1, "PSO2": 2},
            "CO4": {"PO1": 3, "PO2": 2, "PO3": 3, "PO4": 2, "PO5": 3, "PO6": 1, "PO7": 1, "PO11": 1, "PSO2": 2},
            "CO5": {"PO1": 2, "PO2": 2, "PO3": 2, "PO4": 1, "PO5": 1, "PO7": 1, "PO11": 1, "PSO2": 2},
            "CO6": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 2, "PO6": 2, "PO7": 1, "PO8": 2, "PO9": 3, "PO11": 2, "PSO1": 1, "PSO2": 2},
        }
    },
    "25PEC13CE12": {
        "outcomes": [
            ("CO1", "Explain the fundamental concepts of artificial neural networks.", "Understand"),
            ("CO2", "Apply deep neural network concepts to train and optimize multi-layered feedforward neural networks.", "Apply"),
            ("CO3", "Analyze convolutional neural network (CNN) architectures and autoencoders for feature extraction & data reconstruction.", "Analyze"),
            ("CO4", "Apply recurrent neural network architectures to solve complex sequential data problems.", "Apply"),
            ("CO5", "Apply deep reinforcement learning solutions for real-world problems.", "Apply"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 2, "PO8": 2, "PO9": 1, "PO11": 1, "PSO1": 3},
            "CO2": {"PO1": 3, "PO2": 3, "PO3": 2, "PO4": 1, "PO5": 3, "PO7": 1, "PO8": 2, "PO9": 1, "PO11": 1, "PSO1": 3},
            "CO3": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 2, "PO5": 3, "PO7": 1, "PO8": 2, "PO9": 1, "PO11": 2, "PSO1": 3},
            "CO4": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 3, "PO5": 3, "PO7": 1, "PO8": 2, "PO9": 1, "PO11": 2, "PSO1": 3},
            "CO5": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 3, "PO5": 3, "PO6": 2, "PO7": 1, "PO8": 2, "PO9": 1, "PO10": 2, "PO11": 2, "PSO1": 3, "PSO2": 1},
        }
    },
    "25PEC13CE13": {
        "outcomes": [
            ("CO1", "Describe the fundamentals of cyber security and cyber law.", "Understand"),
            ("CO2", "Evaluate database security challenges and recommend effective protection strategies to ensure confidentiality and availability of data.", "Evaluate"),
            ("CO3", "Investigate operating system vulnerabilities, security features, and hardening techniques.", "Analyze"),
            ("CO4", "Evaluate network and wireless security concepts fundamentals.", "Evaluate"),
            ("CO5", "Analyze web application threats and strategies for implementing secure practices.", "Analyze"),
        ],
        "copo": {
            "CO1": {"PO1": 3, "PO2": 2, "PO4": 2, "PO7": 2, "PO11": 3, "PSO2": 2},
            "CO2": {"PO1": 3, "PO2": 2, "PO3": 2, "PO4": 2, "PO5": 2, "PO6": 2, "PO7": 2, "PO11": 3, "PSO1": 2, "PSO2": 3},
            "CO3": {"PO1": 3, "PO2": 2, "PO3": 2, "PO4": 2, "PO5": 2, "PO6": 2, "PO7": 2, "PO11": 3, "PSO2": 3},
            "CO4": {"PO1": 3, "PO2": 3, "PO4": 2, "PO5": 2, "PO6": 2, "PO7": 2, "PO11": 2, "PSO1": 2, "PSO2": 3},
            "CO5": {"PO1": 3, "PO2": 3, "PO3": 2, "PO4": 2, "PO5": 2, "PO6": 2, "PO7": 3, "PO11": 2, "PSO1": 2, "PSO2": 3},
        }
    }
}

async def seed_exam_data():
    async with AsyncSessionLocal() as session:
        print("[Exam Seeder] Populating Course Outcomes & CO-PO Articulation Matrices...")
        for code, data in SYLLABUS_CO_DATA.items():
            course = (await session.execute(select(Course).where(Course.code == code))).scalar_one_or_none()
            if not course:
                print(f"[Warning] Course {code} not found in DB. Skipping.")
                continue

            # Check existing outcomes
            existing_cos = (await session.execute(select(CourseOutcome).where(CourseOutcome.course_id == course.id))).scalars().all()
            existing_codes = {co.co_code for co in existing_cos}

            for co_code, desc, bloom in data["outcomes"]:
                if co_code not in existing_codes:
                    co = CourseOutcome(
                        course_id=course.id,
                        co_code=co_code,
                        description=desc,
                        bloom_level=bloom,
                    )
                    session.add(co)
                    print(f"  + Added {co_code} for {course.name}")

            # Populate CO-PO mappings
            for co_code, po_map in data["copo"].items():
                for po_code, weight in po_map.items():
                    existing_mapping = (
                        await session.execute(
                            select(CourseCOPOMapping).where(
                                CourseCOPOMapping.course_id == course.id,
                                CourseCOPOMapping.co_code == co_code,
                                CourseCOPOMapping.po_code == po_code,
                            )
                        )
                    ).scalar_one_or_none()
                    if not existing_mapping:
                        m = CourseCOPOMapping(
                            course_id=course.id,
                            co_code=co_code,
                            po_code=po_code,
                            weight=weight,
                        )
                        session.add(m)

        await session.commit()
        print("[Exam Seeder] Seeding finished successfully!")

if __name__ == "__main__":
    asyncio.run(seed_exam_data())
