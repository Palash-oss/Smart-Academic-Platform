from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.attendance import router as attendance_router
from app.api.chat import router as chat_router
from app.api.enrollments import router as enrollments_router

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
