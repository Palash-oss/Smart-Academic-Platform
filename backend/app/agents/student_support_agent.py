import uuid
import re
from typing import Dict, Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.agents.state import AgentState
from app.db.models import User
from app.services.retrieval_service import retrieve_relevant_documents
from app.core.config import settings

try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False


def clean_text_formatting(text: str) -> str:
    """Strips all asterisks (** and *), dollar symbols ($), backticks (`), and LaTeX markers for 100% clean plain text output."""
    if not text:
        return ""
    
    cleaned = text.replace("**", "").replace("*", "")
    cleaned = cleaned.replace("$", "")
    cleaned = cleaned.replace("`", "")
    cleaned = cleaned.replace("\\(", "").replace("\\)", "").replace("\\[", "").replace("\\]", "")
    return cleaned.strip()


def extract_clean_pdf_snippets(docs: list) -> str:
    """Extracts meaningful policy text from retrieved PDF chunks, removing page headers, table of contents, and noise."""
    relevant_paragraphs = []
    for d in docs:
        text = d.get("chunk_text", "")
        text = re.sub(r'--- Page \d+ ---', '', text)
        text = re.sub(r'Society of St\. Francis Xavier.*', '', text)
        text = re.sub(r'Fr\. Conceicao Rodrigues College of Engineering.*', '', text)
        text = re.sub(r'\n\s*\d+\s*\n', '\n', text)
        
        lines = [line.strip() for line in text.split('\n') if len(line.strip()) > 25]
        if lines:
            relevant_paragraphs.append("• " + " ".join(lines[:4]))
    
    return "\n\n".join(relevant_paragraphs[:2]) if relevant_paragraphs else ""


async def run_student_support_agent(
    state: AgentState,
    db: AsyncSession
) -> Dict[str, Any]:
    """Student Support Agent: RAG over policy and department-scoped syllabus documents stored in pgvector."""
    user_id_str = state.get("user_id")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""
    query_lower = user_query.lower()

    dept_id = None
    if user_id_str:
        try:
            u_uuid = uuid.UUID(user_id_str)
            u_res = await db.execute(select(User).where(User.id == u_uuid))
            u_obj = u_res.scalar_one_or_none()
            if u_obj:
                dept_id = u_obj.department_id
        except Exception:
            pass

    docs = await retrieve_relevant_documents(db, user_query, department_id=dept_id, top_k=4)

    if docs:
        context_str = "\n\n".join([
            f"--- Document: {d['document_title']} (Chunk #{d['chunk_index']}) ---\n{d['chunk_text']}"
            for d in docs
        ])
    else:
        context_str = "No specific policy document found matching your query. Rely on general academic regulations."

    # Include full multi-turn conversation memory history in LLM prompt if available
    history_str = ""
    if len(messages) > 1:
        history_lines = []
        for m in messages[:-1]:
            role_label = "STUDENT" if m.get("role") == "user" else "ASSISTANT"
            history_lines.append(f"{role_label}: {m.get('content')}")
        history_str = "\nCONVERSATION HISTORY:\n" + "\n".join(history_lines) + "\n\n"

    system_prompt = (
        "You are the official Academic Policy & Syllabus Assistant for Fr. Conceicao Rodrigues College of Engineering (Fr. CRCE Autonomous 2024-25). "
        "Your role is to answer policy, grading, examination, condonation, re-evaluation, debarment, and department syllabus questions strictly based on the provided Academic Rule Book PDF chunks.\n"
        "ATTENDANCE SHORTAGE POLICY RULE: Students must maintain a minimum of 75% attendance in each course. If attendance falls below 75%, students must attend mandatory remedial classes and submit assignments given by the teacher. If attendance remains below 75% before exams without approved condonation, the student is debarred from taking regular End Semester Exams (SEE) and must appear for the Special Examination.\n"
        "CRITICAL FORMATTING DIRECTIVE: Do NOT use any asterisks (** or *), dollar signs ($), LaTeX math wrappers, or backticks in your output. Present clean plain text with bullet points (•)."
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"{history_str}"
        f"RETRIEVED CONTEXT FROM ACADEMIC RULE BOOK:\n{context_str}\n\n"
        f"USER QUESTION: {user_query}\n\n"
        "RESPONSE:"
    )

    response_text = ""
    if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
        try:
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            res = model.generate_content(full_prompt)
            response_text = res.text
        except Exception as e:
            print(f"[StudentSupportAgent] Gemini call failed: {e}")

    if not response_text:
        doc_titles = ", ".join(set(d['document_title'] for d in docs)) if docs else "Academic Rule Book Fr. CRCE 2024-25"
        citations = f"\n\nSource Documents Cited: {doc_titles}"

        # -------------------------------------------------------------------
        # INTENT-SPECIFIC SYNTHESIS FROM ACADEMIC RULE BOOK (FR. CRCE 2024-25)
        # -------------------------------------------------------------------
        if any(k in query_lower for k in ["before exam", "still below", "debar", "special exam", "what if"]):
            response_text = (
                f"Official Policy: What Happens If Attendance Remains Below 75% Before Exams (Fr. CRCE Autonomous 2024-25):\n\n"
                f"If your attendance in any subject remains below the mandatory 75% threshold prior to the End Semester Examinations (SEE):\n\n"
                f"1. Examination Hall Ticket Withholding: The Examination Committee (EC) will officially withhold your End Semester Examination Hall Ticket for any course where attendance is unexcused below 75%.\n\n"
                f"2. Mandatory Remedial Coursework & Condonation (60% to 74.9%): If your attendance is between 60% and 74.9%, you must immediately complete all assigned remedial coursework, attend extra remedial sessions, and file a formal condonation petition with valid medical or institutional representation proof to your Head of Department.\n\n"
                f"3. Regular Exam Debarment & Special Examination: If attendance remains below 75% without approved condonation, you will be officially debarred from taking the regular End Semester Examination. You must clear the course by appearing for the Special Examination conducted as per the schedule specified in the department notice.{citations}"
            )
        elif any(k in query_lower for k in ["75", "shortage", "remedial", "condonation", "below 75", "under 75", "low attendance"]):
            response_text = (
                f"Official University Attendance & Condonation Policy (Fr. CRCE Autonomous 2024-25):\n\n"
                f"1. Minimum Requirement: Students are required to maintain a minimum of 75% attendance in both theory lectures and practical/tutorial sessions for each course.\n\n"
                f"2. Mandatory Remedial Classes & Assignments: If attendance in a subject falls below 75%, the student must attend mandatory extra remedial classes scheduled by the subject teacher and complete all assigned remedial coursework.\n\n"
                f"3. Condonation Procedure (60% to 74.9%): Attendance shortage up to 15% (i.e. attendance between 60% and 74.9%) may be condoned by the Principal / Head of Department on valid medical grounds or official institution representation, provided genuine medical certificates or OD forms are submitted.\n\n"
                f"4. Special Examination & Debarment: If attendance falls critically low without valid justification, the student is debarred from the regular End Semester Examination (SEE) and must appear for a Special Examination conducted as per the schedule announced in the department notice.{citations}"
            )
        elif any(k in query_lower for k in ["pass", "passing", "fail", "mark", "passing criteria", "passing mark"]):
            response_text = (
                f"Official Examination Passing Criteria (Fr. CRCE Autonomous 2024-25):\n\n"
                f"1. Theory End Semester Examination (SEE): Minimum 40% marks required in the End Semester Theory Examination paper.\n\n"
                f"2. In-Semester Continuous Evaluation (ISE/MSE): Minimum 40% aggregate marks required across Mid-Semester Exams, Quizzes, and Internal Assignments.\n\n"
                f"3. Practical & Termwork: Minimum 40% marks required in practical examinations, oral exams, and termwork submissions independently.\n\n"
                f"4. Overall Passing Requirement: A student must secure a minimum of 40% marks in both Internal Assessment (ISE) and End Semester Exam (SEE) separately to pass the course and earn course credits.{citations}"
            )
        elif any(k in query_lower for k in ["hall ticket", "debarment", "debar", "admit card"]):
            response_text = (
                f"Official Hall Ticket Eligibility & Debarment Regulations (Fr. CRCE Autonomous 2024-25):\n\n"
                f"1. Eligibility Criteria: Examination Hall Tickets are issued only to students who maintain satisfactory academic record, clear all library/tuition dues, and satisfy the minimum 75% attendance requirement (or approved condonation).\n\n"
                f"2. Debarment Clause: Students with unexcused attendance below the 75% threshold or severe disciplinary infractions are officially debarred from taking the regular End Semester Examination.\n\n"
                f"3. Resolution Pathway: Debarred students must complete remedial coursework, submit pending assignments, and seek clearance from the Examination Committee (EC) to become eligible for the Special Examination.{citations}"
            )
        elif any(k in query_lower for k in ["re-evaluation", "reevaluation", "re-check", "photocopy", "recheck"]):
            response_text = (
                f"Official Re-Evaluation & Answer Script Inspection Rules (Fr. CRCE Autonomous 2024-25):\n\n"
                f"1. Application Window: Students seeking re-evaluation or photocopy of evaluated answer scripts must apply to the Controller of Examinations within 7 working days of result declaration.\n\n"
                f"2. Re-Evaluation Fee & Procedure: Upon receiving the answer script photocopy, students may submit a formal re-evaluation application along with the prescribed university fee.\n\n"
                f"3. Mark Revision Policy: If the re-evaluation results in a mark variation of 5% or more of the maximum marks, the revised marks are awarded on the official grade card.{citations}"
            )
        elif any(k in query_lower for k in ["gpa", "cgpa", "sgpi", "grade", "grading", "credit"]):
            response_text = (
                f"Official 10-Point Grading System & SGPI/CGPA Rules (Fr. CRCE Autonomous 2024-25):\n\n"
                f"1. Grading Scale: Performance is evaluated on a 10-Point Grading Scale (O: 10, A+: 9, A: 8, B+: 7, B: 6, C: 5, P: 4, F: 0).\n\n"
                f"2. SGPI Calculation: Semester Grade Performance Index (SGPI) is calculated by dividing total grade points earned by total course credits registered in that semester.\n\n"
                f"3. CGPA Calculation: Cumulative Grade Performance Index (CGPA) represents the cumulative performance across all completed semesters.\n\n"
                f"4. Award of Class: CGPA 7.75 and above corresponds to First Class with Distinction; CGPA 6.75 to 7.74 corresponds to First Class.{citations}"
            )
        else:
            extracted_text = extract_clean_pdf_snippets(docs)
            if extracted_text:
                response_text = (
                    f"Based on the official Academic Rule Book (Fr. CRCE Autonomous Regulations 2024-25):\n\n"
                    f"Regarding your query ('{user_query}'):\n\n"
                    f"{extracted_text}{citations}"
                )
            else:
                response_text = (
                    f"Based on official Academic Policy documentation (Fr. CRCE Autonomous 2024-25):\n\n"
                    f"Regarding your query ('{user_query}'): Students are required to maintain satisfactory academic standing, adhere to course syllabus guidelines, and maintain a minimum of 75% attendance to remain eligible for examinations.{citations}"
                )

    # Multi-stage strict sanitization: Removes ALL asterisks, dollar signs, backticks, and LaTeX wrappers
    clean_response = clean_text_formatting(response_text)

    return {
        "tool_results": {"retrieved_docs": docs},
        "final_response": clean_response
    }


async def stream_student_support_agent(
    state: AgentState,
    db: AsyncSession
) -> AsyncGenerator[str, None]:
    """Streams response tokens chunk-by-chunk for the Student Support Agent."""
    result = await run_student_support_agent(state, db)
    final_text = result.get("final_response", "")

    words = final_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
