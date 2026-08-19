from pydantic import BaseModel
from typing import List, Optional, Literal


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class RoutingEvent(BaseModel):
    type: Literal["routing"] = "routing"
    agent: str  # "student_support" | "attendance"
    reasoning: Optional[str] = None


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    content: str


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    agent: str
