import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.services.attendance_service import fetch_student_attendance_records
from app.agents.supervisor import stream_agent_execution

async def run_test():
    async with AsyncSessionLocal() as db:
        user_uuid = uuid.UUID('00000000-0000-0000-0000-000000000001')
        print("[*] Testing fetch_student_attendance_records...")
        res = await fetch_student_attendance_records(db, user_uuid)
        print(f"[OK] Attendance records: student={res['student_name']}, overall={res['overall_percentage']}%, count={len(res['subjects'])}")

        print("[*] Testing stream_agent_execution for: 'What is my attendance status in Data Structures?'...")
        events = []
        async for event in stream_agent_execution(
            user_id=str(user_uuid),
            role="STUDENT",
            user_query="What is my attendance status in Data Structures?",
            db=db
        ):
            events.append(event)
        
        print(f"[OK] Received {len(events)} stream events.")
        print(f"[OK] Sample event output:\n{''.join(events[:4])}")

if __name__ == "__main__":
    asyncio.run(run_test())
