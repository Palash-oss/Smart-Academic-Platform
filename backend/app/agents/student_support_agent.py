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

    docs = await retrieve_relevant_documents(db, user_query, department_id=dept_id, top_k=3)

    if docs:
        context_str = "\n\n".join([
            f"--- Document: {d['document_title']} (Chunk #{d['chunk_index']}) ---\n{d['chunk_text']}"
            for d in docs
        ])
    else:
        context_str = "No specific policy document found matching your query. Rely on general academic regulations."

    system_prompt = (
        "You are the official Academic Student Support Agent for Fr. CRCE. "
        "Your role is to answer policy, grading, exam, academic regulation, and department syllabus questions strictly based on the provided Academic Rule Book PDF chunks.\n"
        "ATTENDANCE SHORTAGE POLICY RULE: If attendance is below 75% in a subject, students must attend mandatory remedial classes and complete all assignments given by the respective subject teacher. If the attendance number is critically low without any valid reason, they must appear for a Special Examination conducted according to the official date announced in the department notice.\n"
        "CRITICAL FORMATTING DIRECTIVE: Do NOT use any asterisks (** or *), dollar signs ($), LaTeX math wrappers, or backticks in your output. Present clean, readable plain text with clear numbered items and bullet points (•)."
    )

    full_prompt = (
        f"{system_prompt}\n\n"
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
        doc_titles = ", ".join(set(d['document_title'] for d in docs)) if docs else "Official Academic Rule Book (Fr. CRCE 2024-25)"
        citations = f"\n\nSource Documents Cited: {doc_titles}"
        
        if "75" in user_query or "shortage" in query_lower or "remedial" in query_lower:
            response_text = (
                f"Official University Attendance Policy (Below 75% Shortage & Special Examination):\n\n"
                f"If a student's attendance falls below 75% in any subject, they are required to attend mandatory remedial classes and complete all assignments assigned by the respective subject teacher for that subject to clear their academic risk.\n\n"
                f"1. Mandatory Remedial Classes: Attend extra remedial lecture sessions scheduled by the subject teacher.\n"
                f"2. Subject Assignment Completion: Complete and submit all academic assignments given by the teacher for that subject.\n"
                f"3. Special Examination: If a student's attendance number is critically low without any justified or valid reason, they must appear for a Special Examination, which will be conducted according to the schedule specified in the official department notice.\n"
                f"4. Risk Clearance: Fulfilling remedial attendance, completing assignments, and passing the Special Examination (if applicable) clears the student's academic risk status and restores exam eligibility.{citations}"
            )
        elif docs:
            top_chunk = docs[0]['chunk_text'].strip()
            clean_chunk = top_chunk.replace("--- Page", "Page").strip()
            response_text = (
                f"Based on the official Academic Rule Book (Fr. CRCE Regulations 2024-25):\n\n"
                f"Regarding your query ('{user_query}'):\n\n"
                f"{clean_chunk}{citations}"
            )
        else:
            response_text = (
                f"Based on official Academic Policy documentation:\n\n"
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
