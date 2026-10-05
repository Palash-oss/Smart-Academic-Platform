#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Starting Smart Academic Platform Backend ==="

# Check if Docker is available and running
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "Starting Backend & Database via Docker Compose..."
    docker compose up -d db backend
    echo "Backend is running on http://localhost:8000"
    echo "API Docs available at http://localhost:8000/docs"
elif [ -f ".venv/bin/python" ]; then
    echo "Starting Backend via local virtualenv..."
    export PYTHONPATH="$DIR/backend"
    .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
elif command -v python3 >/dev/null 2>&1; then
    echo "Starting Backend via system python3..."
    export PYTHONPATH="$DIR/backend"
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "Error: Neither Docker nor Python 3 found!"
    exit 1
fi
