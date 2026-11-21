from typing import Any, TypedDict


class AgentState(TypedDict):
    user_id: str
    role: str
    messages: list[dict[str, str]]
    intent: str | None           # "attendance" | "policy"
    selected_agent: str | None   # "attendance" | "student_support"
    tool_results: dict[str, Any] | None
    final_response: str | None
