# Smart Academic Platform

> **Multi-Agent Academic Assistant & Attendance Intelligence Engine**  
> A full-stack academic command center built with FastAPI, Next.js 14, LangGraph, pgvector, and PostgreSQL.

---

## 🌟 Overview

The **Smart Academic Platform** is a multi-agent academic assistant designed for higher education institutions. It provides a single, unified chat interface backed by an autonomous **LangGraph Supervisor** that dynamically routes student queries to specialized AI agents:

1. **Student Support Agent**: Answers policy, grading, and syllabus questions via RAG (Retrieval-Augmented Generation) over uploaded PDF documents using 768-dimensional `pgvector` embeddings.
2. **Attendance Agent**: Computes attendance percentages, risk flags ($< 75\%$), and consecutive classes needed to clear risk. **Calculations are executed strictly in deterministic Python**, ensuring the LLM never performs arithmetic.

---

## 🚀 Key Features

- **Autonomous Supervisor Routing**: Classifies intent (`policy` vs `attendance`) and streams live SSE routing events before delegating to the appropriate agent subgraph.
- **Live Routing Trace**: Signature interactive visual trace that animates query travel from the supervisor node to the active agent node in real time.
- **Faculty Compliance Ledger**: Monospace audit ledger displaying enrolled student attendance stats with at-risk filtering and per-subject breakdowns.
- **Live Session Attendance Marker**: Faculty interface for marking lecture sessions with real-time database `UPDATE` triggers.
- **Bulk Roster Import**: Import class rosters via CSV (`name,email`) to automatically register student accounts and initialize attendance tracking.
- **Student Attendance Snapshot**: Compact snapshot card pinned above the chat interface showing live student attendance figures.
- **Monochrome Design System**: Crisp White Major (`#F9F9F8`) and Black Minimal (`#0A0A0B`) aesthetic with monospace ledger figures.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Async)
- **Database**: PostgreSQL with `pgvector` extension
- **ORM & Migrations**: SQLAlchemy 2.x & Asyncpg
- **AI Agent Framework**: LangGraph & LangChain
- **Embedding Model**: Google Gemini (`text-embedding-004`) / Fallback Vector Engine
- **Auth & Security**: JWT (HS256) with direct bcrypt password hashing

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Streaming**: Native Server-Sent Events (SSE) reader via `fetch` & `ReadableStream`

---

## 📁 Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- User Accounts
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'FACULTY')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance Logs per Student & Subject
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    total_classes INT NOT NULL,
    attended_classes INT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Uploaded Policy & Syllabus Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    doc_type TEXT,
    source_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector Embeddings for Document Chunks
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(768),
    chunk_index INT
);
```

---

## 🚦 Quick Start Guide

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (or Docker Desktop)

### 1. Environment Setup
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```

Configure your environment variables in `.env`:
```ini
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=smart_academic_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

JWT_SECRET=academic_secret_jwt_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Backend Setup & Data Seeding
```bash
# Create Python Virtual Environment
python -m venv .venv
.\.venv\Scripts\activate   # On Windows

# Install Dependencies
pip install -r backend/requirements.txt

# Populate Realistic Classroom Demo Dataset
python backend/scripts/generate_demo_data.py

# Start Backend API Server (Port 8000)
.\start_backend.bat
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Navigate to **`http://localhost:3000`** in your browser.

---

## 🔑 Demo Quick Login Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Demo Student** | `student@academic.edu` | `student123` |
| **Demo Faculty** | `faculty@academic.edu` | `faculty123` |

---

## 📡 API Reference

### Authentication
- `POST /api/auth/register` — Register a new student or faculty user.
- `POST /api/auth/login` — Authenticate user and receive JWT access token.
- `GET /api/auth/me` — Fetch current authenticated user profile.

### Attendance Service
- `GET /api/attendance/my` — Fetch live attendance snapshot for current student.
- `GET /api/attendance/faculty/overview` — Fetch attendance compliance overview for all students.
- `POST /api/attendance/faculty/mark` — Record live lecture session attendance (`present_student_ids`).
- `POST /api/attendance/faculty/roster/import` — Bulk import class roster via CSV upload.

### Multi-Agent Chat
- `POST /api/chat/stream` — SSE endpoint emitting `routing`, `token`, and `done` events.

---

## 📄 License
MIT License © 2026 Smart Academic Platform Team.
