# Course Registration Engine
> Concurrent-safe university enrollment system with PostgreSQL row-level locking and ACID transaction guarantees.

**Live Demo:** [university-course-registration-engine-kn3ti9l2z.vercel.app](https://university-course-registration-engine-kn3ti9l2z.vercel.app)  
**Backend API:** [university-course-registration-engine.onrender.com](https://university-course-registration-engine.onrender.com)

---

## The Problem This Solves

In a naive enrollment system, two students can simultaneously read "1 seat remaining," both pass the availability check, and both get enrolled — resulting in overbooking. This is a classic race condition.

This project eliminates that using PostgreSQL's row-level locking to serialize concurrent enrollment attempts at the database level.

---

## How the Locking Works

Every enrollment request runs inside an explicit transaction:

```sql
BEGIN;

-- Lock this section row. Any other transaction attempting to lock the same
-- row will block here until this transaction commits or rolls back.
SELECT * FROM sections WHERE id = $1 FOR UPDATE;

-- Safe to check seat count — no other transaction can modify it right now
-- If full: ROLLBACK and return 409
-- If prerequisites unmet: ROLLBACK and return 403

UPDATE sections SET seats_available = seats_available - 1 WHERE id = $1;
INSERT INTO enrollments (student_id, section_id) VALUES ($2, $3);

COMMIT;
```

Without `FOR UPDATE`, two concurrent transactions could both read `seats_available = 1`, both pass the check, and both insert — overbooking the section. The lock prevents this entirely.

---

## Load Test Results

```
Firing 50 simultaneous enrollment attempts at a 10-seat section...

Responses  → enrolled: 10 | full: 40 | failed: 0
Database   → enrolled: 10/10 | seats_available: 0

PASS: enrolled count never exceeded seats_total. Inventory consistent.
```

50 concurrent requests. Exactly 10 enrolled. Zero duplicates.

---

## Features

- **Row-level locking** — `SELECT FOR UPDATE` prevents race conditions under high concurrency
- **ACID transactions** — `BEGIN/COMMIT/ROLLBACK` ensures all-or-nothing enrollment
- **Prerequisite validation** — checked inside the transaction; rolls back if unmet
- **Live seat availability** — updates after every enrollment or drop
- **Registrar console** — browse courses, enroll, drop, view schedule per student

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   React + Vite  │ ──API──▶│  Node.js / Express   │ ──SQL──▶│   PostgreSQL    │
│   (Vercel)      │◀──JSON──│  (Render)            │◀────────│   (Neon.tech)   │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
                                      │
                              POST /api/enroll
                                      │
                              ┌───────▼────────┐
                              │  BEGIN         │
                              │  SELECT FOR    │
                              │  UPDATE        │
                              │  Check seats   │
                              │  Check prereqs │
                              │  UPDATE + INSERT│
                              │  COMMIT        │
                              └────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon.tech) |
| Frontend Deploy | Vercel |
| Backend Deploy | Render |

---

## Running Locally

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# Clone
git clone https://github.com/Srikeerthan505/university-course-registration-engine.git
cd university-course-registration-engine

# Backend
cd backend
cp .env.example .env
# Fill in DATABASE_URL in .env

npm install
node db/run-sql.js schema
node db/run-sql.js seed
npm run start

# Frontend (new terminal)
cd ../frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:10000/api

npm install
npm run dev
```

Visit `http://localhost:5173`

---

## Running the Load Test

```bash
# From project root
node load-test.js
```

Fires 50 concurrent enrollment requests at a single section and verifies the database state is consistent.

---

## Environment Variables

**Backend (`backend/.env`)**
```
DATABASE_URL=postgresql://...
PORT=10000
CLIENT_ORIGIN=http://localhost:5173
```

**Frontend (`frontend/.env`)**
```
VITE_API_URL=http://localhost:10000/api
```
