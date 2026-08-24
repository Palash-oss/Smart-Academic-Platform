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
    """Classifies user intent strictly into 'attendance' (Python Math/Lists/Analytics) or 'policy' (RAG Policy/Syllabus)."""
    query_lower = user_query.lower()

    # 1. ATTENDANCE & ANALYTICS PRIORITY TRIGGERS
    # Any query asking for breakdown, risk lists, student status, class numbers, or percentages MUST route to Attendance Agent
    attendance_triggers = [
        "breakdown", "division breakdown", "risk summary", "at risk", "which students",
        "how many students", "student list", "roster", "enrolled", "my attendance",
        "attendance status", "percentage", "classes needed", "how many classes",
        "comp-a", "comp-b", "aids-a", "ecs-a", "mech-a", "subject breakdown"
    ]

    for a in attendance_triggers:
        if a in query_lower:
            return "attendance"

    # 2. POLICY & SYLLABUS PRIORITY TRIGGERS
    policy_triggers = [
        "policy", "rule", "regulation", "handbook", "guideline", "syllabus",
        "condonation", "re-evaluation", "gpa", "cgpa", "exam hall ticket",
        "debarment", "passing marks", "credit", "leave policy", "shortage policy",
        "minimum requirement", "what is the policy", "what happens if"
    ]

    for p in policy_triggers:
        if p in query_lower:
            return "policy"

    # 3. LLM CLASSIFICATION FOR AMBIGUOUS INPUTS
    if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
        try:
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            prompt = (
                "Classify the following academic user query into exactly one category: 'attendance' or 'policy'.\n"
                "Use 'attendance' if the query asks for attendance numbers, percentages, student risk lists, division breakdown, or class calculations.\n"
                "Use 'policy' if the query asks for official regulations, rules, syllabus topics, or policy procedures.\n\n"
                f"Query: {user_query}\n"
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

    # Default Fallback
    if any(k in query_lower for k in ["percent", "%", "number", "class", "absent", "present", "student"]):
        return "attendance"
    return "policy"


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
    intent = classify_query_intent(user_query)
    selected_agent = "attendance" if intent == "attendance" else "student_support"

    state: AgentState = {
        "user_id": user_id,
        "role": role,
        "messages": [{"role": "user", "content": user_query}],
        "intent": intent,
        "selected_agent": selected_agent,
        "tool_results": None,
        "final_response": None
    }

    # Emit routing SSE event
    routing_data = {
        "type": "routing",
        "agent": selected_agent,
        "reasoning": f"Query classified as '{intent}' intent based on key entities."
    }
    yield f"data: {json.dumps(routing_data)}\n\n"

    # Stream token events
    if selected_agent == "attendance":
        async for token_chunk in stream_attendance_agent(state, db):
            token_data = {"type": "token", "content": token_chunk}
            yield f"data: {json.dumps(token_data)}\n\n"
    else:
        async for token_chunk in stream_student_support_agent(state, db):
            token_data = {"type": "token", "content": token_chunk}
            yield f"data: {json.dumps(token_data)}\n\n"

    done_data = {
        "type": "done",
        "agent": selected_agent
    }
    yield f"data: {json.dumps(done_data)}\n\n"
