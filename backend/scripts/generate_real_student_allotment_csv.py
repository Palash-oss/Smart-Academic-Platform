import asyncio
import csv
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import User, Division, Department

async def generate():
    async with AsyncSessionLocal() as db:
        stmt = (
            select(User)
            .where(User.role == "STUDENT")
            .order_by(User.division_id, User.roll_no)
        )
        res = await db.execute(stmt)
        students = res.scalars().all()
        print(f"Found {len(students)} real students in DB.")

        # Elective pools
        pec_pools = [
            ("25PEC13CE11", "25PEC13CE12", "25PEC13CE13"),
            ("25PEC13CE12", "25PEC13CE13", "25PEC13CE14"),
            ("25PEC13CE13", "25PEC13CE11", "25PEC13CE12"),
            ("25PEC13CE14", "25PEC13CE11", "25PEC13CE13"),
        ]

        pecl_pools = [
            ("25PECL13CE11", "25PECL13CE12", "25PECL13CE13"),
            ("25PECL13CE12", "25PECL13CE15", "25PECL13CE11"),
            ("25PECL13CE13", "25PECL13CE11", "25PECL13CE15"),
            ("25PECL13CE15", "25PECL13CE12", "25PECL13CE13"),
        ]

        oe_pools = [
            ("25OE13CE31", "25OE13CE32", "25OE13CE31"),
            ("25OE13CE32", "25OE13CE31", "25OE13CE32"),
        ]

        rows = []
        base_time = datetime(2026, 7, 15, 9, 0, 0)

        for i, s in enumerate(students):
            div_name = "COMP-A" if "cea" in s.email or (s.student_erp_id and "A" in s.student_erp_id) else "COMP-B"
            t1 = (base_time + timedelta(seconds=i * 45 + 1)).strftime("%Y-%m-%d %H:%M:%S")
            t2 = (base_time + timedelta(seconds=i * 45 + 6)).strftime("%Y-%m-%d %H:%M:%S")
            t3 = (base_time + timedelta(seconds=i * 45 + 11)).strftime("%Y-%m-%d %H:%M:%S")

            pec_p = pec_pools[i % len(pec_pools)]
            pecl_p = pecl_pools[i % len(pecl_pools)]
            oe_p = oe_pools[i % len(oe_pools)]

            # Special preferences for test students if needed
            if "palash" in s.email or s.roll_no == "10265":
                pec_p = ("25PEC13CE13", "25PEC13CE11", "25PEC13CE12") # Cyber Security (Dr. Smita)
                pecl_p = ("25PECL13CE15", "25PECL13CE11", "25PECL13CE12") # Ethical Hacking
                oe_p = ("25OE13CE31", "25OE13CE32", "25OE13CE31")
            elif "shonit" in s.email or s.roll_no == "10277":
                pec_p = ("25PEC13CE11", "25PEC13CE12", "25PEC13CE13") # Blockchain (Dr. Ashok Kanthe)
                pecl_p = ("25PECL13CE11", "25PECL13CE12", "25PECL13CE13")
                oe_p = ("25OE13CE32", "25OE13CE31", "25OE13CE32")
            elif "manav" in s.email or s.roll_no == "10279":
                pec_p = ("25PEC13CE12", "25PEC13CE11", "25PEC13CE13") # Deep Learning (Dr. Kalpana)
                pecl_p = ("25PECL13CE12", "25PECL13CE15", "25PECL13CE11")
                oe_p = ("25OE13CE31", "25OE13CE32", "25OE13CE31")
            elif "saad" in s.email or s.roll_no == "10468":
                pec_p = ("25PEC13CE14", "25PEC13CE13", "25PEC13CE11") # Big Data
                pecl_p = ("25PECL13CE13", "25PECL13CE11", "25PECL13CE15")
                oe_p = ("25OE13CE32", "25OE13CE31", "25OE13CE32")

            rows.append({
                "student_id": s.student_erp_id,
                "roll_no": s.roll_no,
                "department": "Computer",
                "class_div": div_name,
                "academic_term": "2026-27-SEM5",
                "category": "PEC",
                "timestamp": t1,
                "preference_1": pec_p[0],
                "preference_2": pec_p[1],
                "preference_3": pec_p[2],
            })
            rows.append({
                "student_id": s.student_erp_id,
                "roll_no": s.roll_no,
                "department": "Computer",
                "class_div": div_name,
                "academic_term": "2026-27-SEM5",
                "category": "PECL",
                "timestamp": t2,
                "preference_1": pecl_p[0],
                "preference_2": pecl_p[1],
                "preference_3": pecl_p[2],
            })
            rows.append({
                "student_id": s.student_erp_id,
                "roll_no": s.roll_no,
                "department": "Computer",
                "class_div": div_name,
                "academic_term": "2026-27-SEM5",
                "category": "OE",
                "timestamp": t3,
                "preference_1": oe_p[0],
                "preference_2": oe_p[1],
                "preference_3": oe_p[2],
            })

        fieldnames = [
            "student_id", "roll_no", "department", "class_div", "academic_term",
            "category", "timestamp", "preference_1", "preference_2", "preference_3"
        ]

        target_paths = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "allotment_sem5_student_choices.csv")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "allotment_sem5_student_choices.csv")),
        ]

        for p in target_paths:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            print(f"Wrote {len(rows)} choice rows to {p}")

if __name__ == "__main__":
    asyncio.run(generate())
