# CodeGuard AI - Project Summary

## What is CodeGuard AI?

CodeGuard AI is an automated code review system that analyzes GitHub Pull Requests using AI. When you open a PR, it automatically:

1. Receives a webhook notification from GitHub
2. Fetches the PR diff (changed code)
3. Runs three AI agents in parallel to analyze the code
4. Posts a formatted comment on the PR with findings

### The Three AI Agents

| Agent | What It Looks For |
|-------|-------------------|
| **Logic Agent** | Null checks, off-by-one errors, type mismatches, unreachable code |
| **Security Agent** | SQL injection, command injection, XSS, hardcoded secrets |
| **Quality Agent** | PEP8 style, complexity, naming conventions, error handling |

---

## What Has Been Built So Far

### Phase 1 Complete: Foundation Layer

We've built the backend foundation that handles data storage and job queuing. Here's what each component does:

### Phase 2 Complete: GitHub Integration

We've added the ability to receive GitHub webhooks and interact with the GitHub API.

### Phase 3 Complete: LangGraph Agent Framework

We've built the multi-agent AI system that analyzes code using Gemini and LangGraph.

### Phase 4 Complete: API Endpoints

We've built REST API endpoints for the frontend dashboard.

### Phase 5 Complete: Frontend Dashboard

We've built a stunning React dashboard with a "Cyber-Noir Command Center" aesthetic.

#### 1. Pydantic Models (`backend/app/models/`)

These define the shape of our data - like TypeScript interfaces but for Python.

```
Repository    → A connected GitHub repo (github_id, full_name, webhook_secret)
Review        → A PR review record (pr_number, status, findings)
Finding       → A single issue found (severity, file_path, line_number, description)
Settings      → Per-repo config (which agents enabled, severity threshold)
```

**Key Enums:**
- `ReviewStatus`: pending → processing → completed/failed
- `AgentType`: logic, security, quality
- `Severity`: critical, warning, info

#### 2. Database Layer (`backend/app/db/`)

Uses **Supabase** (PostgreSQL as a service) for persistent storage.

**How it works:**
```python
# database.py - Creates a cached connection
client = get_supabase_client()  # Returns same instance every time

# repositories.py - CRUD operations for each entity
repo = RepositoryRepo(client)
repo.create(RepositoryCreate(github_id=123, full_name="owner/repo"))
repo.get_by_github_id(123)
```

**The Repository Pattern:**
Instead of writing SQL queries everywhere, we have dedicated classes:
- `RepositoryRepo` - Manage connected GitHub repos
- `ReviewRepo` - Manage PR reviews
- `FindingRepo` - Manage findings (supports batch insert)
- `SettingsRepo` - Manage per-repo settings (with get_or_create)

#### 3. Queue Service (`backend/app/services/queue.py`)

Uses **Upstash Redis** (Redis as a service) for two purposes:

**A. Job Queue:**
```python
queue = QueueService(redis_client)

# When webhook arrives, add job to queue
queue.enqueue_review(job_id="abc123", data={"pr_number": 42, "repo": "owner/repo"})

# Worker picks up jobs
job = queue.dequeue_review()  # Returns oldest job (FIFO)

# Track job status
queue.set_job_status(job_id, "processing")
queue.set_job_status(job_id, "completed", result={"findings": [...]})
```

**B. Rate Limiting:**
Gemini's free tier allows only 15 requests per minute. The `RateLimiter` enforces this:
```python
limiter = RateLimiter(redis, max_requests=15, window_seconds=60)

if limiter.can_proceed("gemini"):
    limiter.increment("gemini")
    # Make API call
else:
    # Wait or queue for later
```

#### 4. FastAPI Application (`backend/app/main.py`)

The web server that will handle:
- Webhook endpoints (receive GitHub events)
- API endpoints (frontend dashboard)
- Health checks

**Dependency Injection:**
FastAPI automatically provides the right instances to route handlers:
```python
@app.post("/webhook")
def handle_webhook(
    repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
    queue: Annotated[QueueService, Depends(get_queue_service)]
):
    # repo and queue are automatically injected
    pass
```

#### 5. GitHub Service (`backend/app/services/github.py`)

HTTP client for GitHub API operations using **httpx**.

**What it does:**
```python
github = GitHubService(token="ghp_xxx")

# Fetch PR diff for analysis
diff = github.get_pr_diff("owner", "repo", 42)

# Get list of changed files
files = github.get_pr_files("owner", "repo", 42)

# Post review comment on PR
github.post_comment("owner", "repo", 42, "## Review Results\n...")

# Update or delete existing comments
github.update_comment("owner", "repo", comment_id, "Updated content")
github.delete_comment("owner", "repo", comment_id)
```

#### 6. Webhook Handler (`backend/app/api/webhooks.py`)

Receives and processes GitHub webhook events.

**Security:**
- Verifies webhook signatures using HMAC-SHA256
- Rejects requests with invalid signatures (401)

**How it works:**
```python
# POST /api/webhook/github
# Headers: X-GitHub-Event, X-Hub-Signature-256

# 1. Verify signature matches webhook secret
if not verify_signature(body, signature, secret):
    raise HTTPException(401)

# 2. Parse payload using Pydantic models
payload = WebhookPayload.model_validate_json(body)

# 3. Only process PR opened/synchronize events
if payload.action not in ("opened", "synchronize"):
    return {"status": "ignored"}

# 4. Create/get repository record
# 5. Create review record
# 6. Enqueue job for processing
queue.enqueue_review(job_id, data={...})
```

**Pydantic Models for Webhook:**
```
WebhookPayload
├── action: str ("opened", "synchronize", etc.)
├── number: int (PR number)
├── pull_request: GitHubPullRequest
│   ├── title: str
│   ├── head: GitHubHead (sha, ref)
│   └── base: GitHubBase (sha, ref)
├── repository: GitHubRepository
│   ├── id: int
│   └── full_name: str
└── sender: GitHubUser (optional)
```

#### 7. LLM Service (`backend/app/services/llm.py`)

Wraps Google Gemini for AI code analysis.

**What it does:**
```python
llm = LLMService(api_key="your-key")  # Or uses GOOGLE_API_KEY from settings

# Simple text response
response = llm.invoke("Analyze this code...")

# Structured output with Pydantic model
from app.agents.schemas import AgentResponse
result = llm.invoke_structured(prompt, AgentResponse)
# result.findings = [AgentFinding(...), ...]
```

**Configuration:**
- Model: `gemini-2.0-flash-exp`
- Temperature: 0.1 (low for consistent analysis)

#### 8. Code Review Agents (`backend/app/agents/`)

Three specialized agents that analyze code for different issues:

**BaseAgent** - Common functionality:
```python
class BaseAgent:
    def __init__(self, agent_type, prompt_template, llm_service=None):
        self.llm = llm_service or LLMService()

    def analyze(self, diff: str, files: List[str]) -> List[AgentFinding]:
        prompt = format_prompt(self.prompt_template, diff, files)
        response = self.llm.invoke_structured(prompt, AgentResponse)
        return response.findings
```

**Specialized Agents:**
```python
# Each inherits from BaseAgent with its own prompt
LogicAgent()     # Null checks, off-by-one, type errors
SecurityAgent()  # SQL injection, XSS, hardcoded secrets
QualityAgent()   # PEP8, complexity, naming conventions
```

**Agent Schemas:**
```
AgentFinding
├── severity: "critical" | "warning" | "info"
├── file_path: str
├── line_number: Optional[int]
├── title: str
├── description: str
└── suggestion: Optional[str]

AgentResponse
├── findings: List[AgentFinding]
└── summary: str
```

#### 9. Comment Formatter (`backend/app/agents/formatter.py`)

Converts findings into GitHub-flavored markdown:

```python
comment = CommentFormatter.format(logic_findings, security_findings, quality_findings)
```

**Output format:**
```markdown
## CodeGuard AI Review

### Summary
- 🔴 **2 Critical** issues
- 🟡 **3 Warning** issues
- 🔵 **1 Info** issue

### 🔴 Critical Issues

<details>
<summary><b>SQL Injection</b> (src/db.py:42) - Security</summary>

**File:** `src/db.py`
**Line:** 42
**Agent:** Security

User input directly concatenated into SQL query...

**Suggestion:** Use parameterized queries...
</details>
```

#### 10. Pagination Models (`backend/app/models/pagination.py`)

Generic pagination support for API responses.

**Models:**
```python
class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    per_page: int
    pages: int

    @property
    def has_next(self) -> bool:
        return self.page < self.pages

    @property
    def has_prev(self) -> bool:
        return self.page > 1
```

#### 11. Reviews API (`backend/app/api/reviews.py`)

REST API for review data.

**Endpoints:**
```
GET /api/reviews                    → List reviews (paginated)
GET /api/reviews/{review_id}        → Get review with findings
GET /api/repositories/{id}/reviews  → Get reviews for a repo
```

#### 12. Repositories API (`backend/app/api/repositories.py`)

REST API for repository management.

**Endpoints:**
```
GET    /api/repositories            → List repositories (paginated)
POST   /api/repositories            → Create repository
GET    /api/repositories/{id}       → Get repository
DELETE /api/repositories/{id}       → Delete repository
GET    /api/repositories/{id}/settings  → Get settings
PUT    /api/repositories/{id}/settings  → Update settings
```

#### 13. Stats API (`backend/app/api/stats.py`)

Dashboard statistics endpoint.

**Endpoint:**
```
GET /api/stats → Returns:
{
    "total_repositories": 5,
    "total_reviews": 20,
    "reviews_by_status": {
        "pending": 3,
        "processing": 2,
        "completed": 12,
        "failed": 3
    }
}
```

#### 16. Frontend Dashboard (`frontend/`)

A stunning React dashboard with "Cyber-Noir Command Center" aesthetics.

**Design System:**
- **Colors**: Void black (#0a0a0f), electric cyan (#00f0ff), neon magenta (#ff00aa), toxic green (#00ff88)
- **Typography**: JetBrains Mono, Clash Display, Satoshi
- **Effects**: Liquid gradient borders, glow effects, scan-line animations

**Key Components:**
```
NeuralNetwork.tsx   → Animated AI agent visualization (Logic, Security, Quality nodes)
StatsCard.tsx       → Animated stats cards with counters
StatusBadge.tsx     → Glowing status indicators
ReviewCard.tsx      → Review list items with hover effects
Sidebar.tsx         → Navigation with active state animations
```

**Pages:**
- `Dashboard` - Command center with neural network, stats, recent reviews
- `Reviews` - Paginated list with status filtering
- `ReviewDetail` - Single review with findings grouped by severity
- `Repositories` - CRUD management with modals
- `Settings` - Agent toggles, severity threshold, preferences

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Framer Motion (animations)
- React Query (data fetching)
- React Router (navigation)

#### 17. Review Supervisor (`backend/app/agents/supervisor.py`)

Orchestrates parallel execution using LangGraph:

```python
supervisor = ReviewSupervisor()
result = supervisor.run(pr_diff="...", pr_files=["file1.py", "file2.py"])

# result contains:
# - logic_findings: List[AgentFinding]
# - security_findings: List[AgentFinding]
# - quality_findings: List[AgentFinding]
# - final_comment: str (formatted markdown)
```

**LangGraph Flow:**
```
START
  ├── LogicAgent (parallel)
  ├── SecurityAgent (parallel)
  └── QualityAgent (parallel)
         │
         ▼
    combine_findings
         │
         ▼
        END
```

---

## How the System Will Work (Full Flow)

```
┌─────────────────┐
│  GitHub PR      │
│  Created/Updated│
└────────┬────────┘
         │ Webhook POST
         ▼
┌─────────────────┐
│  FastAPI        │
│  /api/webhook   │
└────────┬────────┘
         │ Validate signature
         │ Create Review record
         │ Enqueue job
         ▼
┌─────────────────┐
│  Redis Queue    │
│  (job waiting)  │
└────────┬────────┘
         │ Worker picks up
         ▼
┌─────────────────┐
│  Supervisor     │
│  Agent          │
└────────┬────────┘
         │ Parallel execution
    ┌────┴────┬────────┐
    ▼         ▼        ▼
┌───────┐ ┌───────┐ ┌───────┐
│Logic  │ │Security│ │Quality│
│Agent  │ │Agent   │ │Agent  │
└───┬───┘ └───┬───┘ └───┬───┘
    │         │        │
    └────┬────┴────────┘
         │ Combine findings
         ▼
┌─────────────────┐
│  Format as      │
│  Markdown       │
└────────┬────────┘
         │ GitHub API
         ▼
┌─────────────────┐
│  PR Comment     │
│  Posted!        │
└─────────────────┘
```

---

## Project Structure Explained

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts           # API client functions
│   ├── components/
│   │   ├── Layout.tsx          # Main layout + helpers
│   │   ├── NeuralNetwork.tsx   # Animated AI visualization
│   │   ├── ReviewCard.tsx      # Review list item
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── StatsCard.tsx       # Animated stats cards
│   │   └── StatusBadge.tsx     # Status indicators
│   ├── hooks/
│   │   └── useApi.ts           # React Query hooks
│   ├── pages/
│   │   ├── Dashboard.tsx       # Command center
│   │   ├── Reviews.tsx         # Reviews list
│   │   ├── ReviewDetail.tsx    # Single review
│   │   ├── Repositories.tsx    # Repo management
│   │   └── Settings.tsx        # Configuration
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   ├── App.tsx                 # Router setup
│   ├── main.tsx                # Entry point
│   └── index.css               # Design system
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json

backend/
├── app/
│   ├── main.py          # FastAPI app entry point
│   ├── config.py        # Environment variables (loaded from .env)
│   │
│   ├── models/          # Data schemas (Pydantic)
│   │   ├── repository.py
│   │   ├── review.py
│   │   ├── finding.py
│   │   ├── settings.py
│   │   └── pagination.py    # Generic pagination models
│   │
│   ├── db/              # Database layer
│   │   ├── database.py      # Supabase connection
│   │   └── repositories.py  # CRUD operations
│   │
│   ├── services/        # External services
│   │   ├── queue.py         # Redis queue + rate limiter
│   │   ├── github.py        # GitHub API client
│   │   └── llm.py           # Gemini LLM wrapper
│   │
│   ├── agents/          # AI agents
│   │   ├── schemas.py       # AgentFinding, AgentResponse, ReviewState
│   │   ├── prompts.py       # Prompt templates
│   │   ├── base.py          # BaseAgent class
│   │   ├── logic_agent.py   # Logic error detection
│   │   ├── security_agent.py # Security vulnerability detection
│   │   ├── quality_agent.py # Code quality analysis
│   │   ├── formatter.py     # GitHub markdown formatter
│   │   └── supervisor.py    # LangGraph orchestrator
│   │
│   └── api/             # API routes
│       ├── __init__.py      # Router exports
│       ├── webhooks.py      # GitHub webhook handling
│       ├── reviews.py       # Reviews API endpoints
│       ├── repositories.py  # Repositories CRUD + settings
│       └── stats.py         # Dashboard statistics
│
├── tests/               # Unit tests
│   ├── conftest.py              # Shared test fixtures
│   ├── test_db_repositories.py  # 24 database tests (incl. pagination)
│   ├── test_queue_service.py    # 16 queue tests
│   ├── test_github_service.py   # 11 GitHub API tests
│   ├── test_webhooks.py         # 7 webhook tests
│   ├── test_llm_service.py      # 5 LLM tests
│   ├── test_agent_schemas.py    # 6 schema tests
│   ├── test_prompts.py          # 9 prompt tests
│   ├── test_base_agent.py       # 6 base agent tests
│   ├── test_specialized_agents.py # 9 agent tests
│   ├── test_formatter.py        # 11 formatter tests
│   ├── test_supervisor.py       # 7 supervisor tests
│   ├── test_pagination_models.py # 9 pagination tests
│   ├── test_api_reviews.py      # 6 reviews API tests
│   ├── test_api_repositories.py # 9 repositories API tests
│   └── test_api_stats.py        # 2 stats API tests
│
├── requirements.txt     # Python dependencies
├── pytest.ini          # Test configuration
└── .env.example        # Environment variable template
```

---

## Configuration

### Environment Variables (`.env`)

```bash
# Database (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# AI (Gemini)
GOOGLE_API_KEY=xxx

# GitHub App
GITHUB_APP_ID=xxx
GITHUB_PRIVATE_KEY="-----BEGIN RSA..."
GITHUB_WEBHOOK_SECRET=xxx
GITHUB_TOKEN=ghp_xxx  # Personal access token for API calls
```

### Database Tables

Run this SQL in Supabase to create the tables:

```sql
-- Stores connected GitHub repositories
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores PR review records
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

-- Stores individual findings
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

-- Stores per-repo settings
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

---

## Running the Project

### Prerequisites
1. Python 3.12+
2. Node.js 18+
3. Supabase account (free tier works)
4. Upstash account (free tier works)

### Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy and fill environment variables
cp .env.example .env
# Edit .env with your credentials

# Run tests
python -m pytest  # Should see 138 passed

# Start server
uvicorn app.main:app --reload
# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# Frontend runs at http://localhost:3000

# Production build
npm run build
```

The frontend proxies `/api` requests to `http://localhost:8000`.

---

## What's Next

### Phase 6: Worker Process (Next Up)
- Background job processing
- Full review pipeline integration
- End-to-end testing

---

## Test Coverage

All tests use **mocked** database, Redis, HTTP clients, and LLM (no real services needed).

| Test File | Tests | What It Tests |
|-----------|-------|---------------|
| `test_db_repositories.py` | 24 | All CRUD + pagination for 4 repositories |
| `test_queue_service.py` | 16 | Queue operations + rate limiter |
| `test_github_service.py` | 11 | GitHub API client methods |
| `test_webhooks.py` | 7 | Webhook signature verification + endpoint |
| `test_llm_service.py` | 5 | LLM service initialization + invocation |
| `test_agent_schemas.py` | 6 | AgentFinding, AgentResponse, ReviewState |
| `test_prompts.py` | 9 | Prompt templates + formatting |
| `test_base_agent.py` | 6 | BaseAgent class functionality |
| `test_specialized_agents.py` | 9 | Logic, Security, Quality agents |
| `test_formatter.py` | 11 | Comment formatting for GitHub |
| `test_supervisor.py` | 7 | LangGraph supervisor orchestration |
| `test_pagination_models.py` | 9 | Generic pagination models |
| `test_api_reviews.py` | 6 | Reviews API endpoints |
| `test_api_repositories.py` | 9 | Repositories API endpoints |
| `test_api_stats.py` | 2 | Dashboard stats endpoint |

**Total: 138 tests**

Run tests: `python -m pytest -v`

---

## Key Design Decisions

1. **Supabase over raw PostgreSQL** - Managed service, free tier, built-in auth
2. **Upstash over self-hosted Redis** - REST API (no TCP needed), free tier
3. **Gemini over GPT-4** - Free tier (15 RPM), good for development
4. **Synchronous Redis client** - `upstash-redis` is sync (HTTP-based)
5. **Repository pattern** - Clean separation, easy to test with mocks
6. **FastAPI dependency injection** - Automatic instance management
7. **httpx for HTTP client** - Modern async-capable client (used sync)
8. **HMAC-SHA256 webhook verification** - Industry standard for GitHub webhooks
9. **Dependency overrides in tests** - FastAPI's pattern for mocking dependencies
10. **LangGraph for orchestration** - Parallel agent execution with state management
11. **Structured LLM output** - Pydantic models for type-safe AI responses
12. **BaseAgent inheritance** - DRY pattern for specialized agents
13. **React + TypeScript** - Type-safe frontend with modern tooling
14. **Tailwind CSS** - Utility-first styling for rapid development
15. **Framer Motion** - Smooth, performant animations
16. **React Query** - Automatic caching, refetching, and state management
17. **Cyber-Noir design** - Distinctive aesthetic that stands out from generic dashboards
