from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User
from app.api.auth import get_current_user
from app.schemas.chat import ChatRequest
from app.agents.supervisor import stream_agent_execution

router = APIRouter(prefix="/chat", tags=["Chat Multi-Agent AI"])


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """SSE Endpoint: Accepts query, runs LangGraph supervisor, and streams routing, token, and done events."""
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty."
        )

    generator = stream_agent_execution(
        user_id=str(current_user.id),
        role=current_user.role,
        user_query=request.message,
        db=db
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
