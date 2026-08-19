from typing import TypedDict, List, Dict, Any, Optional


class AgentState(TypedDict):
    user_id: str
    role: str
    messages: List[Dict[str, str]]
    intent: Optional[str]           # "attendance" | "policy"
    selected_agent: Optional[str]   # "attendance" | "student_support"
    tool_results: Optional[Dict[str, Any]]
    final_response: Optional[str]
