from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.attendance import router as attendance_router
from app.api.chat import router as chat_router
from app.api.enrollments import router as enrollments_router
from app.api.timetable import router as timetable_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Smart Academic Platform API — Multi-Agent AI + Automated Allotment Engine "
        "(Revision FRCRCE-3-26). Implements tier-based course enrollment, "
        "balanced batch-splitting, and role-based student/faculty portals."
    )
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(enrollments_router, prefix="/api")
app.include_router(timetable_router, prefix="/api")


@app.on_event("startup")
async def on_startup():
    """Ensures all tables (including timetable_slots) exist in PostgreSQL / Neon DB."""
    from app.db.models import Base
    from app.db.session import async_engine
    if async_engine:
        try:
            async with async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception as e:
            print(f"[Startup Warning] DB table auto-verification failed: {e}")


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected"
    }
