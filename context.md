# CodeGuard AI - Development Context

> **Purpose:** This file provides context for Claude to continue development in new sessions. Read this file at the start of each session.

## Project Overview

CodeGuard AI is a multi-agent PR review system that analyzes Python code for logic errors, security vulnerabilities, and code quality issues, then posts findings as GitHub PR comments with real-time progress tracking.

## Current State: Phase 7 Complete

### Completed Phases

**Phase 1.1: Project Setup** ✅
- FastAPI app skeleton
- Pydantic Settings configuration
- Environment variable template

**Phase 1.2: Database Setup** ✅
- Supabase client with caching
- Repository pattern for data access
- Pydantic models for all entities

**Phase 1.3: Redis Queue Setup** ✅
- Upstash Redis queue service
- Rate limiter for Gemini API (15 RPM)
- Job status tracking

**Phase 2: GitHub Integration** ✅
- GitHub API client for fetching diffs and posting comments
- Webhook signature verification (HMAC-SHA256)
- Webhook endpoint for `pull_request.opened` and `synchronize` events
- Dependency injection for GitHub service

**Phase 3: LangGraph Agent Framework** ✅
- LLM Service wrapping Gemini with structured output support
- Three specialized agents: Logic, Security, Quality
- LangGraph supervisor for parallel agent execution
- Comment formatter for GitHub markdown output
- Dependency injection for ReviewSupervisor

**Phase 4: API Endpoints** ✅
- Generic pagination models (PaginationParams, PaginatedResponse[T])
- Reviews API: list (paginated), get by ID with findings, get by repository
- Repositories API: CRUD operations + settings management
- Dashboard stats endpoint for frontend
- FastAPI dependency injection for all routes

**Phase 5: Frontend Dashboard** ✅
- React + TypeScript + Vite setup
- Cyber-noir design system (dark theme with neon accents)
- Animated neural network visualization for AI agents
- Dashboard with stats cards and status breakdown
- Reviews list with filtering and pagination
- Review detail page with findings by severity
- Repositories management with CRUD modals
- Settings page with toggle switches
- Framer Motion animations throughout

**Phase 5.5: UI Refinements** ✅
- Major Cyber-Noir Command Center aesthetic overhaul
- SchematicCard, NeuralPolyhedron, TerminalFeed components
- StatusIndicators, CommandPalette, SystemBoot, Sparkline components

**Phase 5.6: Database & Integration Setup** ✅
- Supabase database tables created via MCP plugin
- RLS policies configured for service_role access
- Environment fully configured (.env with all credentials)
- LLM service updated for Gemini 2.5 Flash compatibility
- All unit tests passing
- Full end-to-end agent pipeline tested and working

**Phase 6: Background Worker** ✅
- Background thread processor for reviews
- Integration of supervisor with database operations
- Progress broadcasting via WebSocket
- Complete webhook-to-comment flow working

**Phase 7: UI/UX Improvements, WebSocket Progress, Agent Quality** ✅ (Latest)
- WebSocket real-time progress tracking
- Critique Agent for finding deduplication and confidence scoring
- False positive marking API and UI
- Findings by file view toggle
- Toast notification system
- Progress bar component
- Activity feed component
- Database migrations for new fields

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  GitHub                                      │
│                                                                             │
│  PR Created/Updated ──► Webhook ──────────────────────────────────────┐     │
│                                                                       │     │
│  ◄── Comment Posted ◄─────────────────────────────────────────────┐   │     │
└───────────────────────────────────────────────────────────────────│───│─────┘
                                                                    │   │
                                                                    │   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend (FastAPI)                                  │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐  │
│  │  Webhook    │───►│  Background │───►│       Agent Supervisor          │  │
│  │  Handler    │    │  Thread     │    │         (LangGraph)             │  │
│  └─────────────┘    └─────────────┘    │                                 │  │
│         │                 │            │  ┌───────┐ ┌────────┐ ┌───────┐ │  │
│         │                 │            │  │Logic  │ │Security│ │Quality│ │  │
│         │                 │            │  │Agent  │ │Agent   │ │Agent  │ │  │
│         │                 │            │  └───┬───┘ └───┬────┘ └───┬───┘ │  │
│         │                 │            │      └─────────┼─────────┘     │  │
│         │                 │            │                ▼               │  │
│         │                 │            │        ┌───────────────┐       │  │
│         │                 │            │        │ Critique Agent│       │  │
│         │                 │            │        └───────┬───────┘       │  │
│         │                 │            │                ▼               │  │
│         │                 │            │        ┌───────────────┐       │  │
│         │                 │            │        │   Formatter   │       │  │
│         │                 │            │        └───────────────┘       │  │
│         │                 │            └─────────────────────────────────┘  │
│         │                 │                              │                  │
│         │                 │            ┌─────────────────┴──────────────┐   │
│         │                 │            │       WebSocket Manager        │   │
│         │                 │            │  (Real-time progress updates)  │   │
│         │                 │            └────────────────┬───────────────┘   │
│         │                 │                             │                   │
│         ▼                 ▼                             ▼                   │
│  ┌─────────────┐   ┌─────────────┐            ┌─────────────────────┐      │
│  │  Supabase   │   │   Upstash   │            │   Gemini 2.5 Flash  │      │
│  │  (Postgres) │   │   (Redis)   │            │       (LLM)         │      │
│  └─────────────┘   └─────────────┘            └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                               │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Dashboard  │  │   Reviews   │  │Repositories │  │  Settings   │        │
│  │             │  │   List      │  │    List     │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  WebSocket Connection (useReviewProgress hook)                   │       │
│  │  Real-time progress bar, Toast notifications, Activity feed      │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  Cyber-Noir UI Theme │ React Query Caching │ Framer Motion Animations       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Pipeline (LangGraph)

```
START
  │
  ├──────────────────────┬──────────────────────┐
  ▼                      ▼                      ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│  Logic   │      │ Security │      │ Quality  │
│  Agent   │      │  Agent   │      │  Agent   │
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │
     └─────────────────┼─────────────────┘
                       │
                       ▼
              ┌───────────────┐
              │   Critique    │
              │    Agent      │
              │               │
              │ - Deduplicate │
              │ - Confidence  │
              │ - Fix misattr │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │   Combine &   │
              │    Format     │
              └───────┬───────┘
                      │
                      ▼
                     END
```

**Key Points:**
- Logic, Security, Quality agents run **in parallel** via LangGraph
- Critique Agent runs **after** all three agents complete
- Critique Agent uses LLM to deduplicate, assign confidence, fix misattributions
- Final output is GitHub markdown comment

---

## Redis Usage

**Status: ACTIVELY USED via Upstash**

Redis is used for two purposes:

### 1. Rate Limiting (`RateLimiter` class)
- Prevents excessive Gemini API calls
- 15 requests per 60-second sliding window
- Key format: `rate_limit:{key}`
- Uses INCR with EXPIRE for atomic counting

### 2. Job Queue (`QueueService` class)
- Queue key: `codeguard:review_queue`
- Job status keys: `codeguard:job:{job_id}`
- Operations: LPUSH/RPOP for queue, GET/SET for status
- Status TTL: 1 hour

**Note:** While the job queue exists, the current implementation spawns background threads directly from the webhook handler rather than using a separate queue consumer. Redis is primarily used for rate limiting.

---

## WebSocket Real-Time Progress

### Backend
- Endpoint: `WS /ws/reviews/{review_id}`
- `ConnectionManager` singleton manages active connections
- `broadcast_progress()` function in processor sends updates

### Frontend
- `useWebSocket` hook: Generic WebSocket with reconnection
- `useReviewProgress` hook: Wraps useWebSocket for progress state
- `ProgressContext`: Tracks active review being watched
- `ToastContext`: Global toast notifications

### Progress Stages
| Stage | Progress | Description |
|-------|----------|-------------|
| `fetching_diff` | 10% | Fetching PR diff from GitHub |
| `logic_agent` | 25% | Running Logic Agent |
| `security_agent` | 40% | Running Security Agent |
| `quality_agent` | 55% | Running Quality Agent |
| `critique_agent` | 70% | Running Critique Agent |
| `saving_findings` | 85% | Saving findings to database |
| `posting_comment` | 95% | Posting comment to GitHub |
| `complete` | 100% | Review complete |

---

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts           # API client functions
│   ├── components/
│   │   ├── Layout.tsx          # Main layout + PageHeader, EmptyState
│   │   ├── NeuralPolyhedron.tsx # 3D rotating wireframe octahedron
│   │   ├── SchematicCard.tsx   # Military-grade cards with brackets
│   │   ├── TerminalFeed.tsx    # Animated review feed
│   │   ├── StatusIndicators.tsx # Waveform, ProgressRing, etc.
│   │   ├── CommandPalette.tsx  # Cmd+K search palette
│   │   ├── SystemBoot.tsx      # Boot sequence animation
│   │   ├── Sparkline.tsx       # Live micro-charts
│   │   ├── Sidebar.tsx         # Holographic navigation sidebar
│   │   ├── ReviewCard.tsx      # Review list item
│   │   ├── StatsCard.tsx       # Animated stats cards
│   │   ├── StatusBadge.tsx     # Status indicators with glow
│   │   ├── ProgressBar.tsx     # Global progress indicator (Phase 7)
│   │   ├── Toast.tsx           # Toast container (Phase 7)
│   │   ├── ActivityFeed.tsx    # Recent activity display (Phase 7)
│   │   └── FindingsByFile.tsx  # Findings grouped by file (Phase 7)
│   ├── context/
│   │   ├── ProgressContext.tsx # Active review tracking (Phase 7)
│   │   └── ToastContext.tsx    # Toast notification system (Phase 7)
│   ├── hooks/
│   │   ├── useApi.ts           # React Query hooks
│   │   ├── useWebSocket.ts     # Generic WebSocket hook (Phase 7)
│   │   └── useReviewProgress.ts # Progress tracking hook (Phase 7)
│   ├── pages/
│   │   ├── Dashboard.tsx       # Main command center
│   │   ├── Reviews.tsx         # Reviews list with pagination
│   │   ├── ReviewDetail.tsx    # Single review with findings (Updated Phase 7)
│   │   ├── Repositories.tsx    # Repository management
│   │   ├── RepositorySettings.tsx # Per-repo settings
│   │   └── Settings.tsx        # Configuration page
│   ├── types/
│   │   └── index.ts            # TypeScript types (Updated Phase 7)
│   ├── App.tsx                 # Router setup (Updated Phase 7)
│   ├── main.tsx                # Entry point
│   └── index.css               # Cyber-noir design system
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json

backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + WebSocket endpoint (Updated Phase 7)
│   ├── config.py            # Pydantic Settings
│   ├── models/
│   │   ├── __init__.py
│   │   ├── repository.py
│   │   ├── review.py        # + progress, current_stage fields (Phase 7)
│   │   ├── finding.py       # + confidence, is_false_positive fields (Phase 7)
│   │   ├── settings.py
│   │   └── pagination.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py      # Supabase client
│   │   └── repositories.py  # + mark_false_positive method (Phase 7)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── queue.py         # QueueService, RateLimiter (Redis)
│   │   ├── github.py        # GitHubService
│   │   ├── llm.py           # LLMService (Gemini)
│   │   └── websocket.py     # ConnectionManager (Phase 7)
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── schemas.py       # + CritiqueResponse, confidence field (Phase 7)
│   │   ├── prompts.py       # + CRITIQUE_AGENT_PROMPT (Phase 7)
│   │   ├── base.py
│   │   ├── logic_agent.py
│   │   ├── security_agent.py
│   │   ├── quality_agent.py
│   │   ├── critique.py      # CritiqueAgent (Phase 7)
│   │   ├── formatter.py
│   │   └── supervisor.py    # + critique node in graph (Phase 7)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── webhooks.py
│   │   ├── reviews.py       # + false positive endpoint (Phase 7)
│   │   ├── repositories.py
│   │   └── stats.py
│   └── worker/
│       ├── __init__.py
│       └── processor.py     # + progress broadcasting (Phase 7)
├── tests/                   # 173+ tests
├── requirements.txt
├── pytest.ini
└── .env.example
```

---

## Database Schema

**Tables in Supabase:**

```sql
-- Repositories table
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    webhook_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table (Updated Phase 7)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    pr_number INTEGER NOT NULL,
    pr_title TEXT,
    commit_sha TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,                    -- Phase 7
    current_stage TEXT,                            -- Phase 7
    comment_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Findings table (Updated Phase 7)
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('logic', 'security', 'quality')),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),  -- Phase 7
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    suggestion TEXT,
    is_false_positive BOOLEAN DEFAULT FALSE,       -- Phase 7
    false_positive_reason TEXT,                    -- Phase 7
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
    agents_enabled JSONB DEFAULT '{"logic": true, "security": true, "quality": true}',
    severity_threshold TEXT DEFAULT 'low' CHECK (severity_threshold IN ('critical', 'high', 'medium', 'low', 'info')),
    auto_approve BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/reviews` | List reviews (paginated) |
| GET | `/api/reviews/{id}` | Get review with findings |
| PUT | `/api/findings/{id}/false-positive` | Mark finding as false positive (Phase 7) |
| GET | `/api/repositories` | List repositories |
| POST | `/api/repositories` | Create repository |
| GET | `/api/repositories/{id}` | Get repository |
| DELETE | `/api/repositories/{id}` | Delete repository |
| GET | `/api/repositories/{id}/settings` | Get settings |
| PUT | `/api/repositories/{id}/settings` | Update settings |
| GET | `/api/repositories/{id}/reviews` | Get repo's reviews |
| POST | `/api/webhook/github` | GitHub webhook handler |
| WS | `/ws/reviews/{id}` | WebSocket for real-time progress (Phase 7) |

---

## Key Technical Decisions

### 1. Background Threading (Not Celery)
The webhook spawns a background thread directly using Python's `threading.Thread`. This was chosen for simplicity over a separate Celery worker process. The Redis queue exists but isn't used for inter-process communication.

### 2. Synchronous Redis Client
The `upstash-redis` Python SDK is synchronous (uses HTTP REST). All queue service methods are **sync** (not async).

### 3. Repository Pattern
Each database entity has a repository class:
- `RepositoryRepo` - GitHub repositories
- `ReviewRepo` - PR reviews (+ progress updates)
- `FindingRepo` - Review findings (+ false positive marking)
- `SettingsRepo` - Per-repo configuration

### 4. LangGraph for Agent Orchestration
Four-node state graph:
1. Logic, Security, Quality agents run in parallel
2. Critique agent runs after all three
3. Combine node formats final output
4. Returns `ReviewState` with all findings and comment

### 5. WebSocket for Real-Time Updates
Instead of polling, the frontend connects via WebSocket to receive progress updates as they happen during review processing.

### 6. Structured LLM Output
`LLMService.invoke_structured()` returns validated Pydantic models from Gemini responses, ensuring type safety.

---

## Environment Variables

Backend requires a `.env` file in `backend/` directory:

```env
# Required - Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# Required - LLM (Google Gemini)
GOOGLE_API_KEY=your-gemini-api-key

# Required - GitHub
GITHUB_TOKEN=your-github-pat

# Optional - Redis (Upstash) - for rate limiting
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Optional - GitHub App (for webhooks)
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY=your-private-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Optional - LangSmith (for tracing)
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=codeguard-ai
LANGCHAIN_TRACING_V2=true
```

---

## Running the Project

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Then edit with your credentials
python -m pytest tests/ -v  # Run tests (173+ tests should pass)
python -m uvicorn app.main:app --reload --port 5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Start dev server at http://localhost:5173
npm run build  # Production build to dist/
```

The frontend proxies `/api` requests to `http://localhost:5000` via Vite config.

---

## Important Files to Read

1. `CLAUDE.md` - Project overview and architecture diagram
2. `explanation.md` - Detailed technical documentation
3. `improvements.md` - Future improvement ideas and priorities
4. `docs/plans/` - Implementation plans for each phase

---

## Test Coverage

- **Backend:** 173+ tests passing
- **Key test files:**
  - `tests/test_websocket.py` - WebSocket manager tests
  - `tests/test_critique_agent.py` - Critique agent tests
  - `tests/test_false_positive.py` - False positive API tests
  - `tests/test_supervisor.py` - LangGraph supervisor tests
  - `tests/test_webhook.py` - Webhook handler tests

---

## Known Issues / TODOs

1. **One failing test:** `test_webhook_invalid_signature` - unrelated to Phase 7
2. **Pydantic Config deprecation warning** - Models use class-based `Config` instead of `ConfigDict`
3. **Redis client not cached** - `get_redis_client()` creates new client each call

---

## Frontend Design System

The frontend uses a "Cyber-Noir Command Center" aesthetic:

### Color Palette
- **Void base**: #050508 (deepest black)
- **Void black**: #0a0a0f
- **Cyber cyan**: #00f0ff
- **Cyber magenta**: #ff00aa
- **Cyber green**: #00ff88
- **Cyber amber**: #ffaa00
- **Cyber crimson**: #ff3366

### Typography
- **Display**: Clash Display (headings)
- **Mono**: JetBrains Mono (code, labels)
- **Body**: Satoshi

### Key Visual Effects
- Scanline overlay (CRT effect)
- Noise texture overlay
- Backdrop blur on panels
- Corner brackets on cards
- Neon glow effects
- Chromatic aberration on headers
- Animated sparkline charts

---

## Phase 7 Summary (Latest Changes)

### New Backend Components
- `services/websocket.py` - ConnectionManager for WebSocket
- `agents/critique.py` - CritiqueAgent for deduplication
- `agents/schemas.py` - CritiqueResponse, confidence field
- `agents/prompts.py` - CRITIQUE_AGENT_PROMPT
- `api/reviews.py` - False positive marking endpoint

### New Frontend Components
- `hooks/useWebSocket.ts` - Generic WebSocket hook
- `hooks/useReviewProgress.ts` - Progress tracking
- `context/ProgressContext.tsx` - Active review state
- `context/ToastContext.tsx` - Toast notifications
- `components/ProgressBar.tsx` - Global progress
- `components/Toast.tsx` - Toast container
- `components/ActivityFeed.tsx` - Activity display
- `components/FindingsByFile.tsx` - File-grouped findings

### Database Migrations Applied
- `reviews` table: Added `progress`, `current_stage`
- `findings` table: Added `confidence`, `is_false_positive`, `false_positive_reason`

### Key Features Added
1. Real-time progress tracking via WebSocket
2. Critique Agent for finding quality improvement
3. Confidence scoring (high/medium/low)
4. False positive marking with reason
5. Findings grouped by file view
6. Toast notification system
