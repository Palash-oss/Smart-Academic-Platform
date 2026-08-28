from typing import Dict, Any, AsyncGenerator, List, Optional
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

    # 1. POLICY & REGULATION PRIORITY TRIGGERS (Check First for rules & consequences)
    policy_triggers = [
        "what if", "what happens", "before exam", "still below", "policy", "rule", "regulation",
        "handbook", "guideline", "syllabus", "condonation", "re-evaluation", "gpa", "cgpa",
        "exam hall ticket", "debarment", "debar", "passing marks", "special exam", "shortage policy",
        "minimum requirement", "remedial policy"
    ]

    for p in policy_triggers:
        if p in query_lower:
            return "policy"

    # 2. ATTENDANCE & PERSONAL LECTURE MATH TRIGGERS (Check Second for personal roster & math)
    attendance_triggers = [
        "which lectures", "which subject", "which classes", "sit more", "attend more",
        "how many classes", "how many lectures", "classes needed", "classes to attend",
        "my percentage", "my attendance", "my status", "am i at risk", "am i failing",
        "breakdown", "division breakdown", "risk summary", "which students", "how many students",
        "student list", "roster", "enrolled", "comp-a", "comp-b", "aids-a", "ecs-a", "mech-a"
    ]

    for a in attendance_triggers:
        if a in query_lower:
            return "attendance"

    # 3. LLM CLASSIFICATION FOR AMBIGUOUS INPUTS
    if HAS_GEMINI and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"):
        try:
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            prompt = (
                "Classify the following academic user query into exactly one category: 'attendance' or 'policy'.\n"
                "Use 'attendance' if the query asks about personal attendance, which lectures to attend, classes needed, percentage status, student risk rosters, or division counts.\n"
                "Use 'policy' if the query asks for official regulations, what happens if attendance is low before exams, consequences, syllabus topics, or policy procedures.\n\n"
                f"Query: {user_query}\n"
                "Respond with ONLY 'attendance' or 'policy'."
            )
            res = model.generate_content(prompt)
            classification = res.text.strip().lower()
            if "policy" in classification:
                return "policy"
            elif "attendance" in classification:
                return "attendance"
        except Exception as e:
            print(f"[Supervisor] Classification LLM error: {e}")

    # Default Fallback
    if any(k in query_lower for k in ["percent", "%", "number", "class", "lecture", "absent", "present"]):
        return "attendance"
    return "policy"


async def stream_agent_execution(
    user_id: str,
    role: str,
    user_query: str,
    db: AsyncSession,
    history: Optional[List[Dict[str, str]]] = None
) -> AsyncGenerator[str, None]:
    """LangGraph Supervisor Stream Orchestrator with Multi-Turn Conversation Memory:
    
    1. Classifies intent -> 'attendance' or 'policy'
    2. Builds message list including conversation history
    3. Yields SSE event: {"type": "routing", "agent": "attendance" | "student_support"}
    4. Executes chosen agent and yields SSE events: {"type": "token", "content": "..."}
    5. Yields SSE event: {"type": "done", "agent": "..."}
    """
    intent = classify_query_intent(user_query)
    selected_agent = "attendance" if intent == "attendance" else "student_support"

    messages = []
    if history:
        for h in history:
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": user_query})

    state: AgentState = {
        "user_id": user_id,
        "role": role,
        "messages": messages,
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
