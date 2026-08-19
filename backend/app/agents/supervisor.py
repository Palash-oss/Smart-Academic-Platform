from typing import Dict, Any, AsyncGenerator
import json
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState
from app.agents.student_support_agent import stream_student_support_agent
from app.agents.attendance_agent import stream_attendance_agent
from app.core.config import settings

try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False


def classify_query_intent(user_query: str) -> str:
    """Classifies user intent into 'attendance' or 'policy' (Student Support).
    
    Uses keywords & fast classification prompt.
    """
    query_lower = user_query.lower()

    # Fast keyword matching for high speed and reliability
    attendance_keywords = [
        "attendance", "absent", "present", "bunk", "classes", "subject",
        "percentage", "threshold", "at risk", "shortage", "eligible", "exam hall ticket"
    ]
    policy_keywords = [
        "policy", "syllabus", "grading", "gpa", "cgpa", "exam", "datesheet",
        "rules", "re-evaluation", "passing marks", "credit", "deferment", "leave", "course"
    ]

    att_score = sum(1 for k in attendance_keywords if k in query_lower)
    pol_score = sum(1 for k in policy_keywords if k in query_lower)

    if att_score > pol_score:
        return "attendance"
    elif pol_score > att_score:
        return "policy"

    # LLM classification if ambiguous
    if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
        try:
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            prompt = (
                "Classify the following query into exactly one category: 'attendance' or 'policy'.\n"
                "Query: " + user_query + "\n"
                "Respond with ONLY 'attendance' or 'policy'."
            )
            res = model.generate_content(prompt)
            classification = res.text.strip().lower()
            if "attendance" in classification:
                return "attendance"
            elif "policy" in classification:
                return "policy"
        except Exception as e:
            print(f"[Supervisor] Classification LLM error: {e}")

    # Default fallback if unknown
    return "attendance" if "attend" in query_lower or "%" in query_lower else "policy"


async def stream_agent_execution(
    user_id: str,
    role: str,
    user_query: str,
    db: AsyncSession
) -> AsyncGenerator[str, None]:
    """LangGraph Supervisor Stream Orchestrator:
    
    1. Classifies intent -> 'attendance' or 'policy'
    2. Yields SSE event: {"type": "routing", "agent": "attendance" | "student_support"}
    3. Executes chosen agent and yields SSE events: {"type": "token", "content": "..."}
    4. Yields SSE event: {"type": "done", "agent": "..."}
    """
    # 1. Classify
    intent = classify_query_intent(user_query)
    selected_agent = "attendance" if intent == "attendance" else "student_support"

    # Initial state
    state: AgentState = {
        "user_id": user_id,
        "role": role,
        "messages": [{"role": "user", "content": user_query}],
        "intent": intent,
        "selected_agent": selected_agent,
        "tool_results": None,
        "final_response": None
    }

    # 2. Emit routing SSE event immediately
    routing_data = {
        "type": "routing",
        "agent": selected_agent,
        "reasoning": f"Query classified as '{intent}' intent based on key entities."
    }
    yield f"data: {json.dumps(routing_data)}\n\n"

    # 3. Stream token events from selected subgraph
    if selected_agent == "attendance":
        async for token_chunk in stream_attendance_agent(state, db):
            token_data = {"type": "token", "content": token_chunk}
            yield f"data: {json.dumps(token_data)}\n\n"
    else:
        async for token_chunk in stream_student_support_agent(state, db):
            token_data = {"type": "token", "content": token_chunk}
            yield f"data: {json.dumps(token_data)}\n\n"

    # 4. Emit done SSE event
    done_data = {
        "type": "done",
        "agent": selected_agent
    }
    yield f"data: {json.dumps(done_data)}\n\n"
