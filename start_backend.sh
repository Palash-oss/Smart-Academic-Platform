#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Starting Smart Academic Platform Backend ==="

# Check if Docker is available
if command -v docker >/dev/null 2>&1; then
    if ! docker info >/dev/null 2>&1; then
        if [ "$(uname -s)" = "Darwin" ] && [ -d "/Applications/Docker.app" ]; then
            echo "Docker daemon is not running. Starting Docker Desktop..."
            open -a Docker
            WAIT_SECONDS=0
            MAX_WAIT=60
            while ! docker info >/dev/null 2>&1; do
                if [ "$WAIT_SECONDS" -ge "$MAX_WAIT" ]; then
                    echo "Error: Docker Desktop did not become ready within ${MAX_WAIT}s."
                    echo "Please wait for Docker Desktop to finish starting and re-run ./start_backend.sh."
                    exit 1
                fi
                sleep 2
                WAIT_SECONDS=$((WAIT_SECONDS + 2))
            done
        else
            echo "Error: Docker is installed, but the Docker daemon is not running."
            echo "Please start Docker and re-run ./start_backend.sh."
            exit 1
        fi
    fi

    echo "Starting Backend & Database via Docker Compose..."
    docker compose up -d db backend
    echo "Backend is running on http://localhost:8000"
    echo "API Docs available at http://localhost:8000/docs"
elif [ -f ".venv/bin/python" ]; then
    echo "Starting Backend via local virtualenv..."
    export PYTHONPATH="$DIR/backend"
    .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
elif command -v python3 >/dev/null 2>&1 && python3 -c "import uvicorn" >/dev/null 2>&1; then
    echo "Starting Backend via system python3..."
    export PYTHONPATH="$DIR/backend"
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "Error: Neither a running Docker environment nor a Python environment with uvicorn was found."
    echo "To run locally without Docker:"
    echo "  python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi
