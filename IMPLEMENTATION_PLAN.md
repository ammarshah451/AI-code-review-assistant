# CodeGuard AI - Implementation Plan

## Overview
Multi-agent PR review system using LangGraph for orchestration, FastAPI for backend, React for frontend.

## Phase 1: Foundation (Backend Core)

### 1.1 Project Setup
- [ ] Initialize Python project with `pyproject.toml` or `requirements.txt`
- [ ] Set up FastAPI app skeleton in `backend/app/main.py`
- [ ] Create config management with Pydantic Settings (`backend/app/config.py`)
- [ ] Add environment variable templates (`.env.example`)

**Dependencies:**
```
fastapi
uvicorn
pydantic
pydantic-settings
python-dotenv
```

### 1.2 Database Setup (Supabase)
- [ ] Create Supabase project at https://supabase.com
- [ ] Design database schema:
  - `repositories` - connected repos
  - `reviews` - PR review records
  - `findings` - individual findings per review
  - `settings` - per-repo configuration
- [ ] Set up Supabase client in `backend/app/db/database.py`
- [ ] Create repository pattern in `backend/app/db/repositories.py`

**Schema:**
```sql
-- repositories
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,  -- owner/repo
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id),
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  commit_sha TEXT,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  comment_id BIGINT,  -- GitHub comment ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id),
  agent_type TEXT NOT NULL,  -- logic, security, quality
  severity TEXT NOT NULL,    -- critical, warning, info
  file_path TEXT,
  line_number INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- settings
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

### 1.3 Redis Queue Setup (Upstash)
- [ ] Create Upstash Redis instance at https://upstash.com
- [ ] Implement queue service in `backend/app/services/queue.py`
- [ ] Add rate limiting logic for Gemini API

**Dependencies:**
```
upstash-redis
```

## Phase 2: GitHub Integration

### 2.1 Webhook Handler
- [ ] Create webhook endpoint in `backend/app/api/webhooks.py`
- [ ] Verify webhook signatures for security
- [ ] Handle `pull_request.opened` events
- [ ] Extract PR diff and file changes

### 2.2 GitHub API Client
- [ ] Implement GitHub client in `backend/app/services/github.py`
- [ ] Functions needed:
  - `get_pr_diff(owner, repo, pr_number)` - fetch PR diff
  - `get_pr_files(owner, repo, pr_number)` - list changed files
  - `post_comment(owner, repo, pr_number, body)` - post review comment
  - `update_comment(owner, repo, comment_id, body)` - update existing comment

**Dependencies:**
```
httpx
PyGithub  # or use httpx directly
```

## Phase 3: LLM & Agents

### 3.1 LLM Service
- [ ] Set up Gemini client in `backend/app/services/llm.py`
- [ ] Create prompt templates for each agent type
- [ ] Add structured output parsing with Pydantic models
- [ ] Implement retry logic with exponential backoff

**Dependencies:**
```
google-generativeai
langchain-google-genai  # for LangGraph integration
```

### 3.2 Agent Implementation
- [ ] Define Finding model in `backend/app/models/finding.py`:
```python
class Finding(BaseModel):
    agent_type: Literal["logic", "security", "quality"]
    severity: Literal["critical", "warning", "info"]
    file_path: str
    line_number: Optional[int]
    title: str
    description: str
    suggestion: Optional[str]
```

- [ ] Implement Logic Agent (`backend/app/agents/logic_agent.py`):
  - Prompt focused on: null checks, off-by-one, type mismatches, unreachable code

- [ ] Implement Security Agent (`backend/app/agents/security_agent.py`):
  - Prompt focused on: SQL injection, command injection, XSS, hardcoded secrets

- [ ] Implement Quality Agent (`backend/app/agents/quality_agent.py`):
  - Prompt focused on: PEP8, complexity, naming, error handling

### 3.3 Supervisor with LangGraph
- [ ] Install LangGraph and set up supervisor in `backend/app/agents/supervisor.py`
- [ ] Create parallel execution graph:
```python
from langgraph.graph import StateGraph, END

# Define state
class ReviewState(TypedDict):
    pr_diff: str
    files: list[str]
    logic_findings: list[Finding]
    security_findings: list[Finding]
    quality_findings: list[Finding]
    final_comment: str

# Create graph with parallel branches
graph = StateGraph(ReviewState)
graph.add_node("logic", logic_agent)
graph.add_node("security", security_agent)
graph.add_node("quality", quality_agent)
graph.add_node("combine", combine_findings)

# Parallel execution from START
graph.add_edge(START, "logic")
graph.add_edge(START, "security")
graph.add_edge(START, "quality")

# All converge to combine
graph.add_edge("logic", "combine")
graph.add_edge("security", "combine")
graph.add_edge("quality", "combine")
graph.add_edge("combine", END)
```

**Dependencies:**
```
langgraph
langchain-core
```

### 3.4 Comment Formatter
- [ ] Create markdown formatter for GitHub comments
- [ ] Group findings by severity (Critical first)
- [ ] Format with collapsible sections per agent
- [ ] Add summary statistics

**Example output format:**
```markdown
## CodeGuard AI Review

### Summary
- 🔴 2 Critical issues
- 🟡 3 Warnings
- 🔵 5 Info suggestions

### Critical Issues

<details>
<summary>🔴 SQL Injection in user_query.py:45</summary>

**Description:** User input directly concatenated into SQL query...

**Suggestion:** Use parameterized queries...
</details>

...
```

## Phase 4: API Endpoints

### 4.1 Review History API
- [ ] `GET /api/reviews` - list reviews with pagination
- [ ] `GET /api/reviews/{id}` - get review details with findings
- [ ] `GET /api/repositories/{repo_id}/reviews` - reviews for specific repo

### 4.2 Settings API
- [ ] `GET /api/repositories/{repo_id}/settings` - get repo settings
- [ ] `PUT /api/repositories/{repo_id}/settings` - update settings
- [ ] `POST /api/repositories` - connect new repository

## Phase 5: Frontend

### 5.1 Project Setup
- [ ] Initialize Vite + React + TypeScript project
- [ ] Set up Tailwind CSS
- [ ] Configure API client with fetch/axios
- [ ] Set up React Router

**Commands:**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install tailwindcss postcss autoprefixer
npm install react-router-dom
npm install @tanstack/react-query  # for data fetching
```

### 5.2 Pages
- [ ] **Dashboard** (`/`) - overview of recent reviews, stats
- [ ] **Reviews List** (`/reviews`) - paginated review history
- [ ] **Review Detail** (`/reviews/:id`) - full review with findings
- [ ] **Repositories** (`/repositories`) - manage connected repos
- [ ] **Settings** (`/settings/:repoId`) - per-repo configuration

### 5.3 Components
- [ ] `ReviewCard` - summary card for review list
- [ ] `FindingItem` - individual finding display
- [ ] `SeverityBadge` - colored badge for severity
- [ ] `AgentIcon` - icon per agent type
- [ ] `StatsChart` - simple chart for dashboard

## Phase 6: Deployment

### 6.1 Backend (Railway)
- [ ] Create `Dockerfile` for backend
- [ ] Set up Railway project
- [ ] Configure environment variables
- [ ] Set up health check endpoint

### 6.2 Frontend (Vercel)
- [ ] Configure `vercel.json` if needed
- [ ] Set up environment variables for API URL
- [ ] Deploy from GitHub

### 6.3 Monitoring (LangSmith)
- [ ] Set up LangSmith project
- [ ] Add tracing to LangGraph
- [ ] Create evaluation datasets
- [ ] Set up alerts for failures

## Phase 7: Polish & Extras

- [ ] Add authentication (GitHub OAuth)
- [ ] Rate limit dashboard display
- [ ] Email notifications for critical findings
- [ ] Webhook retry mechanism
- [ ] Error tracking (Sentry)

---

## Service Setup Checklist

### Supabase
1. Go to https://supabase.com and create account
2. Create new project
3. Run SQL schema from Phase 1.2
4. Get connection string and anon key

### Upstash Redis
1. Go to https://upstash.com and create account
2. Create new Redis database
3. Get REST URL and token

### Google AI (Gemini)
1. Go to https://aistudio.google.com
2. Get API key
3. Note: Free tier has 15 RPM limit

### GitHub App (for webhooks)
1. Go to GitHub Settings > Developer Settings > GitHub Apps
2. Create new GitHub App
3. Set webhook URL to your backend
4. Generate webhook secret
5. Set permissions: Pull requests (read), Contents (read)

### LangSmith
1. Go to https://smith.langchain.com
2. Create account and project
3. Get API key

---

## Environment Variables

```env
# Backend
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
GOOGLE_API_KEY=xxx
GITHUB_APP_ID=xxx
GITHUB_PRIVATE_KEY=xxx
GITHUB_WEBHOOK_SECRET=xxx
LANGCHAIN_API_KEY=xxx
LANGCHAIN_PROJECT=codeguard-ai

# Frontend
VITE_API_URL=https://your-backend.railway.app
```

---

## Estimated Milestones

1. **Foundation** - Backend skeleton, DB, Redis
2. **GitHub Flow** - Webhooks working, can receive PRs
3. **Agents MVP** - Single agent working end-to-end
4. **Full Agents** - All 3 agents in parallel
5. **Frontend MVP** - Basic dashboard showing reviews
6. **Deployment** - Live on Railway/Vercel
7. **Polish** - Auth, monitoring, error handling
