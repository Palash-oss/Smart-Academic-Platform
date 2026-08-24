import uuid
from typing import Dict, Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.agents.state import AgentState
from app.db.models import User, Department
from app.services.attendance_service import (
    fetch_student_attendance_records,
    fetch_all_students_faculty_overview
)
from app.core.config import settings

try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False


async def run_attendance_agent(
    state: AgentState,
    db: AsyncSession
) -> Dict[str, Any]:
    """Attendance Agent: Computes attendance percentages & risk flags in Python, formatting clean responses without asterisks."""
    user_id_str = state.get("user_id")
    role = state.get("role", "STUDENT")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""
    query_lower = user_query.lower()

    try:
        user_uuid = uuid.UUID(user_id_str)
    except Exception:
        user_uuid = uuid.UUID("00000000-0000-0000-0000-000000000001")

    user_stmt = select(User).where(User.id == user_uuid)
    user_res = await db.execute(user_stmt)
    user_obj = user_res.scalar_one_or_none()

    if user_obj and user_obj.role == "FACULTY":
        # ----------------------------------------------------
        # FACULTY ATTENDANCE INTELLIGENCE
        # ----------------------------------------------------
        overview = await fetch_all_students_faculty_overview(db, faculty_dept_id=user_obj.department_id)

        dept_code = overview[0]["department_code"] if overview else "COMP"
        total_enrolled = len(overview)
        at_risk_students = [s for s in overview if s["overall_risk"]]
        at_risk_count = len(at_risk_students)

        div_summary: Dict[str, Dict[str, Any]] = {}
        for s in overview:
            div_key = s["division_label"]
            if div_key not in div_summary:
                div_summary[div_key] = {"total": 0, "at_risk": 0, "sum_pct": 0.0}
            div_summary[div_key]["total"] += 1
            div_summary[div_key]["sum_pct"] += s["overall_percentage"]
            if s["overall_risk"]:
                div_summary[div_key]["at_risk"] += 1

        div_lines = []
        for div_label, info in sorted(div_summary.items()):
            avg_pct = round(info["sum_pct"] / info["total"], 1) if info["total"] > 0 else 0.0
            div_lines.append(
                f"• Division {div_label}:\n"
                f"  - Enrolled Capacity: {info['total']} Students\n"
                f"  - Students At Risk (<75%): {info['at_risk']} Students ({round((info['at_risk']/info['total'])*100, 1)}%)\n"
                f"  - Average Division Attendance: {avg_pct}%"
            )

        at_risk_formatted_lines = [
            f"{idx + 1}. {s['student_name']} ({s['division_label']}) — {s['overall_percentage']}% Overall ({s['subjects_at_risk']} subjects at risk)"
            for idx, s in enumerate(at_risk_students)
        ]

        system_prompt = (
            "You are the Academic Command Center Attendance Intelligence Engine for Faculty. "
            "You are providing department-level attendance analytics computed deterministically by the Python backend service. "
            "Do NOT perform arithmetic yourself. Answer the faculty member's question clearly and professionally. "
            "CRITICAL: Do NOT use any asterisks (**), markdown bolding, or backticks in your output. Present clean plain text with bullet points."
        )

        full_prompt = (
            f"{system_prompt}\n\n"
            f"DETERMINISTIC DEPARTMENT ATTENDANCE DATA:\n"
            f"Faculty Member: {user_obj.full_name}\n"
            f"Department: {dept_code}\n"
            f"Total Enrolled Students: {total_enrolled}\n"
            f"Total At-Risk Students (<75%): {at_risk_count}\n"
            f"Division Breakdown:\n" + "\n".join([f"- {k}: {v['total']} total, {v['at_risk']} at risk" for k, v in div_summary.items()]) + "\n\n"
            f"At-Risk Students List:\n" + "\n".join([f"- {s['student_name']} ({s['division_label']}): {s['overall_percentage']}%" for s in at_risk_students[:15]]) + "\n\n"
            f"FACULTY QUESTION: {user_query}\n\n"
            "RESPONSE:"
        )

        response_text = ""
        if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
            try:
                model = genai.GenerativeModel(settings.GEMINI_MODEL)
                res = model.generate_content(full_prompt)
                response_text = res.text
            except Exception as e:
                print(f"[AttendanceAgent] Gemini call failed: {e}")

        if not response_text:
            if "breakdown" in query_lower or "division" in query_lower:
                response_text = (
                    f"Here is the Division Attendance Breakdown for the {dept_code} Department:\n\n" +
                    "\n\n".join(div_lines) + "\n\n" +
                    f"• Total Department Capacity: {total_enrolled} Students across {len(div_summary)} Divisions.\n" +
                    f"• Overall Department Risk: {at_risk_count} / {total_enrolled} Students (<75%)."
                )
            elif "risk" in query_lower or "student" in query_lower or "list" in query_lower:
                sample_list = "\n".join(at_risk_formatted_lines[:12]) if at_risk_formatted_lines else "All students are currently in good standing."
                response_text = (
                    f"Here are the Students At Risk (<75% Attendance) in the {dept_code} Department:\n\n"
                    f"{sample_list}\n\n"
                    f"• Total At-Risk Count: {at_risk_count} out of {total_enrolled} Enrolled Students."
                )
            else:
                response_text = (
                    f"Attendance Intelligence Summary for {user_obj.full_name} ({dept_code} Department):\n\n"
                    f"• Total Enrolled Students: {total_enrolled}\n"
                    f"• Total Students At Risk (<75%): {at_risk_count}\n\n"
                    f"Division Breakdown:\n" +
                    "\n".join([f"• {k}: {v['total']} Enrolled | {v['at_risk']} At Risk" for k, v in div_summary.items()])
                )

        context_data = {
            "role": "FACULTY",
            "department_code": dept_code,
            "total_enrolled": total_enrolled,
            "at_risk_count": at_risk_count
        }

    else:
        # ----------------------------------------------------
        # STUDENT ATTENDANCE INTELLIGENCE
        # ----------------------------------------------------
        attendance_data = await fetch_student_attendance_records(db, user_uuid)

        overall_pct = attendance_data["overall_percentage"]
        overall_risk = attendance_data["overall_risk"]
        subjects = attendance_data["subjects"]

        subject_lines = []
        at_risk_subjects = []
        for s in subjects:
            status_tag = "[!] AT RISK (<75%)" if s["is_at_risk"] else "[OK] GOOD STANDING"
            subject_lines.append(
                f"- {s['subject']}: {s['attended_classes']}/{s['total_classes']} classes ({s['percentage']}%) — {status_tag}. "
                f"Classes needed for 75%: {s['classes_needed_to_clear_risk']}"
            )
            if s["is_at_risk"]:
                at_risk_subjects.append(s)

        subjects_summary = "\n".join(subject_lines) if subject_lines else "No attendance logs found."

        system_prompt = (
            "You are the Student Attendance Assistant. "
            "The numerical attendance data below was computed deterministically by the backend Python service. "
            "Do NOT perform any arithmetic yourself. Present and explain the numbers clearly and professionally. "
            "CRITICAL: Do NOT use any asterisks (**), markdown bolding, or backticks in your output. Present clean plain text with bullet points."
        )

        full_prompt = (
            f"{system_prompt}\n\n"
            f"COMPUTED ATTENDANCE DATA:\n"
            f"Student Name: {attendance_data['student_name']}\n"
            f"Overall Attendance: {overall_pct}% (Risk Status: {'AT RISK' if overall_risk else 'GOOD STANDING'})\n"
            f"Subject Breakdown:\n{subjects_summary}\n\n"
            f"STUDENT QUERY: {user_query}\n\n"
            "RESPONSE:"
        )

        response_text = ""
        if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
            try:
                model = genai.GenerativeModel(settings.GEMINI_MODEL)
                res = model.generate_content(full_prompt)
                response_text = res.text
            except Exception as e:
                print(f"[AttendanceAgent] Gemini call failed: {e}")

        if not response_text:
            if subjects:
                risk_msg = ""
                if at_risk_subjects:
                    risk_msg = "\n\n[!] Action Required:\nIf your attendance is below 75% in any subject, you are required to attend mandatory remedial classes and complete all assignments given by the respective subject teacher to clear your risk:\n" + "\n".join([
                        f"• {s['subject']}: Currently {s['percentage']}%. Attend next {s['classes_needed_to_clear_risk']} consecutive classes, sit remedial lectures, and submit assignments."
                        for s in at_risk_subjects
                    ])
                else:
                    risk_msg = "\n\nAll your subjects meet the required 75% attendance threshold."

                subject_formatted = "\n".join([
                    f"• {s['subject']}: {s['attended_classes']}/{s['total_classes']} classes ({s['percentage']}%) — {'[!] At Risk' if s['is_at_risk'] else '[OK] Good Standing'}"
                    for s in subjects
                ])

                response_text = (
                    f"Here is your attendance summary, {attendance_data['student_name']}:\n\n"
                    f"• Overall Attendance: {overall_pct}% ({'[!] At Risk' if overall_risk else '[OK] Good Standing'})\n\n"
                    f"Enrolled Course Breakdown:\n{subject_formatted}"
                    f"{risk_msg}"
                )
            else:
                response_text = "No attendance records found for your account in the system database."

        context_data = attendance_data

    # Strip any residual asterisks or backticks from final response
    clean_response = response_text.replace("**", "").replace("`", "")

    return {
        "tool_results": context_data,
        "final_response": clean_response
    }


async def stream_attendance_agent(
    state: AgentState,
    db: AsyncSession
) -> AsyncGenerator[str, None]:
    """Streams response tokens chunk-by-chunk for the Attendance Agent."""
    result = await run_attendance_agent(state, db)
    final_text = result.get("final_response", "")

    words = final_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
