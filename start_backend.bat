@echo off
echo Starting Smart Academic Platform FastAPI Backend...
cd /d "%~dp0"
set PYTHONPATH=%CD%\backend
cd backend
if exist "..\.venv\Scripts\python.exe" (
    ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)
