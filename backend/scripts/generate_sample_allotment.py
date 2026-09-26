"""
Generate a demo allotment Excel file for testing the Allotment Engine.

Creates: sample_allotment.xlsx in the project root with:
  - 60 CE-A students enrolled in Tier 1 CLASS courses (PCC + VSEC)
  - 50 students (CE-A + CE-B mixed) for Tier 2 DEPARTMENT PEC elective
  - 30 students from multiple departments for Tier 3 INSTITUTE OE course

Usage:
    python scripts/generate_sample_allotment.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd


def make_students(prefix: str, count: int, dept: str, class_div: str, start_roll: int = 1):
    return [
        {
            "student_id": f"ST2024{prefix}{i:03d}",
            "roll_no": f"24{prefix}{start_roll + i - 1:03d}",
            "department": dept,
            "class_div": class_div,
        }
        for i in range(1, count + 1)
    ]


def generate():
    rows = []
    academic_term = "2026-27-SEM5"

    # ── Tier 1: CLASS courses for CE-A (60 students)
    ce_a_students = make_students("CE", 60, "Computer", "CE-A")

    # INTEGRATED_TH_PR: Cryptography — 1 theory section, 3 balanced batches
    for s in ce_a_students:
        rows.append({**s, "course_code": "25PCC13CE19", "academic_term": academic_term})

    # INTEGRATED_TH_PR: Computer Networks
    for s in ce_a_students:
        rows.append({**s, "course_code": "25PCC13CE22", "academic_term": academic_term})

    # PRACTICAL_ONLY: Cloud Computing Lab — no theory, independent batch faculty
    for s in ce_a_students:
        rows.append({**s, "course_code": "25VSE13CE04", "academic_term": academic_term})

    # THEORY_TUTORIAL: TCS — 1 theory + tutorial batches, same faculty
    for s in ce_a_students:
        rows.append({**s, "course_code": "25PCC13CE21", "academic_term": academic_term})

    # ── Tier 2: DEPARTMENT PEC elective (78 students across CE-A + CE-B)
    ce_a_pec = make_students("CE", 39, "Computer", "CE-A")
    ce_b_pec = make_students("CB", 39, "Computer", "CE-B", start_roll=101)

    for s in ce_a_pec + ce_b_pec:
        rows.append({**s, "course_code": "25PEC13CE11", "academic_term": academic_term})  # Blockchain

    # ── Tier 3: INSTITUTE OE (30 students from multiple departments)
    ce_oe = make_students("CE", 10, "Computer", "CE-A")
    it_oe = make_students("IT", 10, "Information Tech", "IT-A", start_roll=1)
    ai_oe = make_students("AI", 10, "AI & Data Science", "AIDS-A", start_roll=1)

    for s in ce_oe + it_oe + ai_oe:
        rows.append({**s, "course_code": "25OE13CE3X", "academic_term": academic_term})

    df = pd.DataFrame(rows, columns=[
        "student_id", "roll_no", "department", "class_div", "course_code", "academic_term"
    ])

    output_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..", "sample_allotment.xlsx"
    )
    output_path = os.path.normpath(output_path)
    df.to_excel(output_path, index=False)
    print(f"[OK] Sample allotment file saved to: {output_path}")
    print(f"   Total rows: {len(df)}")
    print(f"   Unique students: {df['student_id'].nunique()}")
    print(f"   Courses: {df['course_code'].unique().tolist()}")


if __name__ == "__main__":
    generate()
