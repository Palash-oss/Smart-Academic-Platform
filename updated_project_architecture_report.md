# 🏛️ Smart Academic Platform — Comprehensive Technical & Architectural Report (Updated Edition)

---

## 1. Executive Summary

The **Smart Academic Platform** is an enterprise-grade, autonomous **Multi-Agent Academic Command Center** engineered for higher education institutions (configured for Fr. Conceicao Rodrigues College of Engineering — Fr. CRCE Autonomous Regulations 2024-25).

The platform bridges the gap between **institutional policy handbooks** and **real-time student analytics** by combining two powerful paradigms:
1. **Zero Arithmetic Errors (Deterministic Python Engine)**: All numerical calculations — overall percentages, division averages, at-risk rosters (<75%), and exact consecutive classes needed to clear risk — are calculated deterministically in Python. Large Language Models (LLMs) are **never permitted to do arithmetic**, eliminating mathematical hallucinations.
2. **Instant Policy Retrieval (768-Dimensional pgvector RAG)**: Institutional handbooks, passing rules, condonation guidelines, re-evaluation rules, and department syllabi (208 vector chunks from the **Academic Rule Book PDF**) are stored in **PostgreSQL with pgvector**, enabling semantic retrieval with source citations.

---

## 2. Updated System Architecture & Data Flow

```
                               ┌──────────────────────────────────────────────┐
                               │             Next.js 14 App Router            │
                               │   (TypeScript, TailwindCSS, Lucide Icons)    │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                           HTTP / SSE Token Stream
                                            (With Conversation History)
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           FastAPI Backend Service            │
                               │           (Async Python, Pydantic)           │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │         LangGraph Supervisor Router          │
                               │  (Intent Classifier: Policy vs Personal Math) │
                               └──────────────┬────────────────┬──────────────┘
                                              │                │
                      ┌───────────────────────┘                └────────────────────────┐
                      ▼                                                                 ▼
┌───────────────────────────────────────────┐                     ┌───────────────────────────────────────────┐
│     Department Attendance Agent           │                     │     Faculty Policy & Syllabus Agent       │
│     (Deterministic Python Math Engine)    │                     │        (768d pgvector Cosine RAG)         │
└─────────────────────┬─────────────────────┘                     └─────────────────────┬─────────────────────┘
                      │                                                                 │
                      └───────────────────────────────┬─────────────────────────────────┘
                                                      │
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │              PostgreSQL Database             │
                               │  (pgvector, SQLAlchemy Async, asyncpg driver)│
                               └──────────────────────────────────────────────┘
```

---

## 3. Key Subsystems & Architectural Components

### Subsystem A: Intent Classification & Supervisor Router (`supervisor.py`)
The **LangGraph Supervisor Router** acts as the central traffic controller for all incoming user queries:

- **Priority 1 — Policy & Exam Consequences**:
  If a user asks about rules, handbook regulations, attendance shortage consequences (*"what if before exam my attendance is still below 75%"*), condonation (60%-74.9%), hall tickets, debarment, or re-evaluation, the router selects **`student_support` (Policy RAG Engine)**.
- **Priority 2 — Personal Attendance & Numerical Analytics**:
  If a user asks about personal lecture counts (*"can you tell me which lectures i have to sit more"*), personal percentage, division breakdowns, or at-risk student rosters, the router selects **`attendance` (Attendance Math Engine)**.
- **Live SSE Event Emission**:
  The router emits a real-time SSE event:
  `data: {"type": "routing", "agent": "attendance" | "student_support"}`
  The frontend (`LiveRoutingTrace.tsx`) renders an animated beam of light moving to the active agent node.

---

### Subsystem B: Deterministic Python Math Engine (`attendance_agent.py`)
- **Mathematical Accuracy**: Offloads 100% of arithmetic calculations to Python.
- **Formulas**:
  - Overall Percentage = (Attended Classes / Total Classes) * 100
  - Consecutive Classes Needed for 75% = Ceil( (0.75 * Total - Attended) / (1 - 0.75) )
- **Student Analytics**:
  Displays per-course percentages, at-risk flags (`[!] AT RISK` vs `[OK] GOOD STANDING`), and the exact number of consecutive classes needed to clear risk for each subject.
- **Faculty Analytics**:
  Computes enrolled capacity, division breakdowns (`COMP-A`, `COMP-B`), average division attendance, and sorted at-risk rosters (<75%).

---

### Subsystem C: 768-Dimensional pgvector Policy RAG (`student_support_agent.py`)
- **PDF Vector Ingestion**: Extracted 208 overlapping chunks with page markers from `Academic_Rule_Book_FrCRCE_2024_25.pdf` and generated 768-dimensional embeddings stored in PostgreSQL.
- **Multi-Turn Conversation Memory**: Integrates full conversation history (`history`) into the state, allowing multi-turn follow-up questions to retain context.
- **Intelligent Policy Synthesizer**: Formats policy rules into structured, readable sections:
  1. Minimum 75% requirement
  2. Mandatory remedial coursework & assignments
  3. Condonation procedure for 60% to 74.9% (medical/institutional grounds)
  4. Regular exam debarment & Special Examination mandate

---

### Subsystem D: Daily Session Cap & Undo Register (`/faculty/mark`)
- **Max 2 Daily Sessions Cap**: Restricts faculty from marking more than 2 lecture sessions per day for any course/division.
- **Session History & Undo**: Each lecture session creates a `LectureSession` record. Faculty can inspect session logs and click **`[Undo Session]`** to decrement class counters cleanly.
- **Roster CSV Bulk Import**: Upload CSV rosters (`name,email`) to register student accounts automatically.

---

### Subsystem E: Multi-Stage Text Sanitization
- Centralized sanitization function (`clean_text_formatting`) strips all raw asterisks, dollar signs, backticks, and LaTeX math wrappers across all agent outputs.
- Ensures all responses render in **clean, readable plain text** with bullet points (•) and numbered lists.

---

## 4. Database Schema Reference

```
 ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
 │     departments      │        │      divisions       │        │       courses        │
 ├──────────────────────┤        ├──────────────────────┤        ├──────────────────────┤
 │ id (UUID, PK)        │◄───────┤ id (UUID, PK)        │        │ id (UUID, PK)        │
 │ name (VARCHAR)       │        │ department_id (FK)   │        │ department_id (FK)   │
 │ code (VARCHAR)       │        │ name (VARCHAR)       │        │ name (VARCHAR)       │
 └──────────┬───────────┘        │ student_count (INT)  │        │ code (VARCHAR)       │
            │                    └──────────┬───────────┘        └──────────┬───────────┘
            │                               │                               │
            │                    ┌──────────┴───────────┐                   │
            └───────────────────►│        users         │◄──────────────────┘
                                 ├──────────────────────┤
                                 │ id (UUID, PK)        │
                                 │ email (VARCHAR, UNQ) │
                                 │ full_name (VARCHAR)  │
                                 │ role (STUDENT/FACULTY│
                                 │ department_id (FK)   │
                                 │ division_id (FK)     │
                                 └──────────┬───────────┘
                                            │
                                 ┌──────────┴───────────┐
                                 │   attendance_logs    │
                                 ├──────────────────────┤
                                 │ id (UUID, PK)        │
                                 │ student_id (FK)      │
                                 │ course_id (FK)       │
                                 │ subject (VARCHAR)    │
                                 │ total_classes (INT)  │
                                 │ attended_classes(INT)│
                                 └──────────────────────┘
```

---

## 5. Active Demo Credentials Map

| Demo Role | Full Name | Email | Password | Scope & Attendance Data |
| :--- | :--- | :--- | :--- | :--- |
| **Demo Student 1** | Alex Mercer | `student@academic.edu` | `student123` | COMP-A (86.1% Overall - Good Standing) |
| **Demo Student 2** | Rahul Sharma | `atrisk.student@academic.edu` | `student123` | COMP-A (71.6% Overall - [!] AT RISK across all 9 subjects) |
| **Demo Faculty** | Prof. David Vance | `faculty@academic.edu` | `faculty123` | COMP Faculty (COMP-A & COMP-B — 140 Students Ledger) |

---

## 6. API Endpoints Reference

| Method & Path | Auth | Description |
| :--- | :--- | :--- |
| `POST /api/auth/login` | None | Authenticates email/password, returns JWT token & user metadata. |
| `GET /api/attendance/my` | Student | Returns student's per-subject attendance percentages & at-risk flags. |
| `GET /api/attendance/faculty/overview` | Faculty | Returns department-scoped overview of all students, divisions, and at-risk counts. |
| `GET /api/attendance/faculty/sessions` | Faculty | Fetches marked sessions history for a date and course. |
| `POST /api/attendance/faculty/mark` | Faculty | Records a live lecture session (+1 total, +1 attended if present). Enforces 2/day cap. |
| `POST /api/attendance/faculty/sessions/{id}/undo` | Faculty | Reverts a previously submitted lecture session. |
| `POST /api/chat/stream` | Student / Faculty | SSE streaming endpoint returning routing events, token chunks, and done events with conversation history. |

---

## 7. Verification & Edge Case Handling Summary

1. **Personal Lecture Queries**:
   *"can you tell me which lectures i have to sit more"* $\rightarrow$ Routes to **Student Attendance Agent**, returning the exact subject list with current percentages and consecutive classes needed.
2. **Exam Debarment Queries**:
   *"what if before exam my attendance is still below 75%"* $\rightarrow$ Routes to **Student Support Policy Agent**, returning the 3-step Exam Debarment & Special Examination policy.
3. **Faculty Roster Queries**:
   *"Show division breakdown for my department"* $\rightarrow$ Routes to **Student Attendance Agent**, returning exact COMP-A & COMP-B mathematical analytics.
