import uuid
from typing import Dict, Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState
from app.services.attendance_service import fetch_student_attendance_records
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
    """Attendance Agent: Calls attendance_service to calculate percentages & risk in Python, then formats response."""
    user_id_str = state.get("user_id")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    try:
        student_id = uuid.UUID(user_id_str)
    except Exception:
        # Fallback to default demo student if unparseable
        student_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    # Call Python service for exact deterministic calculation (NEVER ask LLM to do math)
    attendance_data = await fetch_student_attendance_records(db, student_id)

    # Format deterministic breakdown for LLM context
    overall_pct = attendance_data["overall_percentage"]
    overall_risk = attendance_data["overall_risk"]
    subjects = attendance_data["subjects"]

    subject_lines = []
    at_risk_subjects = []
    for s in subjects:
        status_tag = "⚠️ AT RISK (<75%)" if s["is_at_risk"] else "✅ OK"
        subject_lines.append(
            f"- {s['subject']}: {s['attended_classes']}/{s['total_classes']} classes ({s['percentage']}%) — {status_tag}. "
            f"Classes needed for 75%: {s['classes_needed_to_clear_risk']}"
        )
        if s["is_at_risk"]:
            at_risk_subjects.append(s)

    subjects_summary = "\n".join(subject_lines) if subject_lines else "No attendance logs found."

    system_prompt = (
        "You are the Attendance Assistant. "
        "The numerical attendance data below was computed deterministically by the backend Python service. "
        "Do NOT perform any arithmetic yourself. Present and explain the numbers clearly to the student, highlighting any subjects at risk (<75%) "
        "and telling them exactly how many consecutive classes they need to attend."
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
        # Structured deterministic fallback response
        if subjects:
            risk_msg = ""
            if at_risk_subjects:
                risk_msg = "\n\n⚠️ **Action Required:** You are below the 75% threshold in:\n" + "\n".join([
                    f"• **{s['subject']}**: Currently {s['percentage']}%. You must attend the next **{s['classes_needed_to_clear_risk']}** consecutive classes to reach 75%."
                    for s in at_risk_subjects
                ])
            else:
                risk_msg = "\n\n🎉 Great job! All your subjects are above the required 75% attendance threshold."

            response_text = (
                f"Here is your attendance summary, **{attendance_data['student_name']}**:\n\n"
                f"• **Overall Attendance:** `{overall_pct}%` ({'⚠️ At Risk' if overall_risk else '✅ Good Standing'})\n\n"
                f"**Subject Breakdown:**\n" +
                "\n".join([f"• **{s['subject']}**: {s['attended_classes']}/{s['total_classes']} classes (`{s['percentage']}%`)" for s in subjects]) +
                risk_msg
            )
        else:
            response_text = "No attendance records found for your account in the system database."

    return {
        "tool_results": attendance_data,
        "final_response": response_text
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
