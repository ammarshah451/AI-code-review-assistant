# CodeGuard AI - Bootup Guide

Complete guide to set up and run CodeGuard AI from scratch.

---

## Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| Python | 3.12+ | https://python.org/downloads |
| Node.js | 18+ | https://nodejs.org |
| Git | Latest | https://git-scm.com |

### External Services (Free Tier)

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Supabase** | PostgreSQL database | https://supabase.com |
| **Upstash** | Redis queue & rate limiting | https://upstash.com |
| **Google AI Studio** | Gemini LLM API | https://aistudio.google.com |
| **GitHub** | Webhooks & API | https://github.com/settings/tokens |

---

## Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd AI-code-review-assistant
```

---

## Step 2: Set Up External Services

### 2.1 Supabase (Database)

1. Go to https://supabase.com and create a new project
2. Go to **SQL Editor** and run this schema:

```sql
-- Repositories table
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id),
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  commit_sha TEXT,
  status TEXT DEFAULT 'pending',
  comment_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Findings table
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id),
  agent_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id) UNIQUE,
  enabled BOOLEAN DEFAULT true,
  agents_enabled JSONB DEFAULT '{"logic": true, "security": true, "quality": true}',
  severity_threshold TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. Go to **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_KEY`

### 2.2 Upstash (Redis)

1. Go to https://upstash.com and create a new Redis database
2. Copy from the dashboard:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2.3 Google AI Studio (Gemini LLM)

1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API Key**
3. Copy the key → `GOOGLE_API_KEY`

> **Note**: Free tier allows 15 requests per minute

### 2.4 GitHub Token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes: `repo`, `read:org`
4. Copy the token → `GITHUB_TOKEN`

### 2.5 GitHub Webhook Secret (Optional - for production)

Generate a random secret for webhook verification:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Save this as `GITHUB_WEBHOOK_SECRET`

---

## Step 3: Configure Environment Variables

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
# Environment
ENVIRONMENT=development

# Supabase (Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upstash (Redis)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Google AI (Gemini LLM)
GOOGLE_API_KEY=your-gemini-api-key

# GitHub
GITHUB_TOKEN=ghp_your-github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Optional: GitHub App (for production)
# GITHUB_APP_ID=123456
# GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```

---

## Step 4: Install Dependencies

### Backend (Python)

```bash
cd backend
pip install -r requirements.txt
```

### Frontend (Node.js)

```bash
cd frontend
npm install
```

---

## Step 5: Verify Installation

### Run Backend Tests

```bash
cd backend
python -m pytest
```

Expected output: `138 passed`

### Check Frontend Builds

```bash
cd frontend
npm run build
```

Expected output: `✓ built in X.XXs`

---

## Step 6: Start the Application

Open **two terminals**:

### Terminal 1: Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Server runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

Dashboard runs at: http://localhost:3000

---

## Quick Start Commands

```bash
# From project root

# Install everything
cd backend && pip install -r requirements.txt && cd ../frontend && npm install && cd ..

# Run tests
cd backend && python -m pytest && cd ..

# Start backend (Terminal 1)
cd backend && python -m uvicorn app.main:app --reload

# Start frontend (Terminal 2)
cd frontend && npm run dev
```

---

## Service URLs

| Service | URL |
|---------|-----|
| Frontend Dashboard | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/reviews` | List reviews (paginated) |
| GET | `/api/reviews/{id}` | Get review with findings |
| GET | `/api/repositories` | List repositories |
| POST | `/api/repositories` | Connect repository |
| DELETE | `/api/repositories/{id}` | Disconnect repository |
| GET | `/api/repositories/{id}/settings` | Get settings |
| PUT | `/api/repositories/{id}/settings` | Update settings |
| POST | `/api/webhook/github` | GitHub webhook endpoint |

---

## Troubleshooting

### "uvicorn not found" or path errors

Use Python module syntax:
```bash
python -m uvicorn app.main:app --reload
```

### "Module not found" errors

Make sure you're in the correct directory:
```bash
cd backend  # For backend commands
cd frontend # For frontend commands
```

### Database connection errors

1. Check `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
2. Verify tables exist in Supabase SQL Editor

### Redis connection errors

1. Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. Verify Redis database is active in Upstash dashboard

### Frontend can't reach backend

1. Make sure backend is running on port 8000
2. Vite proxies `/api` to `http://localhost:8000` automatically

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| **Backend** | FastAPI, Python 3.12, Pydantic |
| **Database** | Supabase (PostgreSQL) |
| **Queue** | Upstash (Redis) |
| **LLM** | Google Gemini 2.0 Flash |
| **Orchestration** | LangGraph |

---

## Next Steps

1. Open http://localhost:3000 to see the dashboard
2. Connect a GitHub repository
3. Open a PR on that repository
4. Watch the AI review appear!
