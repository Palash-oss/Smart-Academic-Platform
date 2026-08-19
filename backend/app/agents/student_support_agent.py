import uuid
from typing import Dict, Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState
from app.services.retrieval_service import retrieve_relevant_documents
from app.core.config import settings

# Try importing Google GenAI for response generation
try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False


async def run_student_support_agent(
    state: AgentState,
    db: AsyncSession
) -> Dict[str, Any]:
    """Student Support Agent: RAG over policy and syllabus documents stored in pgvector."""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # 1. Retrieve top-k relevant policy/syllabus document chunks via pgvector
    docs = await retrieve_relevant_documents(db, user_query, top_k=3)

    if docs:
        context_str = "\n\n".join([
            f"--- Document: {d['document_title']} (Chunk #{d['chunk_index']}) ---\n{d['chunk_text']}"
            for d in docs
        ])
    else:
        context_str = "No specific policy document found matching your exact query. Rely on general university regulation guidelines."

    system_prompt = (
        "You are the official Academic Student Support Agent. "
        "Your role is to answer student policy, grading, academic regulation, and syllabus questions strictly based on the provided retrieved documents.\n"
        "Always provide accurate, clear, helpful answers with references to official policy titles where applicable."
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"RETRIEVED CONTEXT:\n{context_str}\n\n"
        f"STUDENT QUESTION: {user_query}\n\n"
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
        # Fallback response formatting
        citations = f"\n\n*Source Documents Cited:* " + ", ".join(set(d['document_title'] for d in docs)) if docs else ""
        response_text = (
            f"Based on the official Academic Policy documentation:\n\n"
            f"Regarding your query ('{user_query}'): Academic regulations require students to maintain satisfactory academic standing, adhere to course syllabus guidelines, and follow standard university appeal procedures for attendance/grading exceptions.{citations}"
        )

    return {
        "tool_results": {"retrieved_docs": docs},
        "final_response": response_text
    }


async def stream_student_support_agent(
    state: AgentState,
    db: AsyncSession
) -> AsyncGenerator[str, None]:
    """Streams response tokens chunk-by-chunk for the Student Support Agent."""
    result = await run_student_support_agent(state, db)
    final_text = result.get("final_response", "")

    # Stream in word/token chunks
    words = final_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
