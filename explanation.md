# CodeGuard AI - Technical Documentation

> A multi-agent AI system that automatically reviews GitHub pull requests for logic errors, security vulnerabilities, and code quality issues.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Backend Structure](#backend-structure)
4. [Frontend Structure](#frontend-structure)
5. [Database Schema](#database-schema)
6. [Agent System](#agent-system)
7. [Webhook Flow](#webhook-flow)
8. [Real-Time Progress Tracking](#real-time-progress-tracking)
9. [Configuration](#configuration)
10. [Key Design Patterns](#key-design-patterns)

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
│         │                 │            │        │ (Deduplicate) │       │  │
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

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend Framework** | FastAPI 0.115 | REST API, WebSocket support, async |
| **Database** | Supabase (PostgreSQL) | Data persistence, RLS policies |
| **Cache/Queue** | Upstash Redis | Rate limiting, job queue |
| **LLM** | Google Gemini 2.5 Flash | Code analysis via LangChain |
| **Agent Orchestration** | LangGraph | Parallel agent execution with Critique Agent |
| **Tracing** | LangSmith | LLM call monitoring |
| **Frontend Framework** | React 18 + TypeScript | UI components |
| **Build Tool** | Vite | Fast dev server, HMR |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Animations** | Framer Motion | Declarative animations |
| **Data Fetching** | TanStack React Query | Caching, refetching |
| **Real-time** | WebSocket | Live progress updates |

---

## Backend Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Pydantic settings from .env
│   │
│   ├── api/                  # REST API endpoints
│   │   ├── __init__.py
│   │   ├── repositories.py   # CRUD for repositories
│   │   ├── reviews.py        # Review listing and details
│   │   ├── stats.py          # Dashboard statistics
│   │   └── webhooks.py       # GitHub webhook handler
│   │
│   ├── agents/               # AI agent system
│   │   ├── __init__.py
│   │   ├── base.py           # BaseAgent abstract class
│   │   ├── logic_agent.py    # Logic error detection
│   │   ├── security_agent.py # Security vulnerability detection
│   │   ├── quality_agent.py  # Code quality analysis
│   │   ├── critique.py       # Critique Agent for deduplication
│   │   ├── supervisor.py     # LangGraph orchestration
│   │   ├── prompts.py        # Agent prompt templates
│   │   ├── schemas.py        # Pydantic schemas for agents
│   │   └── formatter.py      # GitHub comment formatting
│   │
│   ├── db/                   # Database layer
│   │   ├── __init__.py
│   │   ├── database.py       # Supabase client
│   │   └── repositories.py   # Repository pattern classes
│   │
│   ├── models/               # Pydantic data models
│   │   ├── __init__.py
│   │   ├── repository.py
│   │   ├── review.py
│   │   ├── finding.py
│   │   ├── settings.py
│   │   └── pagination.py
│   │
│   ├── services/             # External service integrations
│   │   ├── __init__.py
│   │   ├── github.py         # GitHub API client
│   │   ├── llm.py            # Gemini LLM wrapper
│   │   ├── queue.py          # Redis queue & rate limiter
│   │   └── websocket.py      # WebSocket connection manager
│   │
│   └── worker/               # Background processing
│       ├── __init__.py
│       └── processor.py      # Review processing logic
│
├── tests/                    # Pytest test suite
├── requirements.txt
└── healthcheck.py            # System health verification
```

### Key Files Explained

#### `app/main.py`
The FastAPI application entry point. Sets up:
- CORS middleware for frontend access
- Four API routers (repositories, reviews, stats, webhooks)
- WebSocket endpoint for real-time progress (`/ws/reviews/{review_id}`)
- Dependency injection for services
- Health check endpoints

#### `app/config.py`
Pydantic Settings class that loads configuration from environment variables:
- Supabase credentials
- Redis credentials
- Google API key for Gemini
- GitHub tokens and webhook secrets
- LangSmith tracing config

#### `app/worker/processor.py`
The heart of the review process. The `process_review()` function:
1. Updates review status to PROCESSING
2. Broadcasts progress via WebSocket at each stage
3. Fetches PR diff from GitHub
4. Runs all four agents via ReviewSupervisor (Logic, Security, Quality, Critique)
5. Saves findings to database (with confidence scores)
6. Posts formatted comment to GitHub
7. Updates review status to COMPLETED

#### `app/services/websocket.py`
WebSocket connection manager (Phase 7):
- Singleton `ConnectionManager` class
- Tracks active WebSocket connections per review_id
- `broadcast()` method sends progress to all connected clients
- Handles connection/disconnection lifecycle

#### `app/agents/critique.py`
Critique Agent for finding quality improvement (Phase 7):
- Runs after Logic, Security, and Quality agents
- Deduplicates findings across agents
- Assigns confidence scores (high/medium/low)
- Fixes misattributed findings
- Returns `CritiqueResponse` with cleaned findings

---

## Frontend Structure

```
frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Router configuration
│   ├── index.css             # Global styles + Cyber-Noir theme
│   │
│   ├── api/
│   │   └── client.ts         # API client functions
│   │
│   ├── hooks/
│   │   ├── useApi.ts         # React Query hooks
│   │   ├── useWebSocket.ts   # Generic WebSocket hook
│   │   └── useReviewProgress.ts # Review progress tracking
│   │
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx     # Main dashboard with stats
│   │   ├── Reviews.tsx       # Review list with pagination
│   │   ├── ReviewDetail.tsx  # Single review with findings
│   │   ├── Repositories.tsx  # Repository management
│   │   ├── RepositorySettings.tsx
│   │   └── Settings.tsx      # Global settings
│   │
│   ├── context/
│   │   ├── ProgressContext.tsx   # Global progress tracking
│   │   └── ToastContext.tsx      # Toast notification system
│   │
│   └── components/
│       ├── Layout.tsx        # Page layout wrapper
│       ├── Sidebar.tsx       # Navigation sidebar
│       ├── SchematicCard.tsx # Military-grade card design
│       ├── NeuralPolyhedron.tsx  # 3D rotating octahedron
│       ├── TerminalFeed.tsx  # Review activity feed
│       ├── StatusIndicators.tsx  # Waveforms, progress rings
│       ├── CommandPalette.tsx    # Cmd+K search
│       ├── SystemBoot.tsx    # Startup animation
│       ├── Sparkline.tsx     # Mini charts
│       ├── ReviewCard.tsx
│       ├── StatusBadge.tsx
│       ├── ProgressBar.tsx   # Global progress indicator
│       ├── Toast.tsx         # Toast notifications
│       ├── ActivityFeed.tsx  # Recent activity display
│       └── FindingsByFile.tsx # Findings grouped by file
│
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind + custom theme
├── package.json
└── tsconfig.json
```

### Design System: Cyber-Noir

The frontend uses a custom "Cyber-Noir" design system inspired by military command centers:

**Color Palette:**
- `void`: #0a0a0f (deep black background)
- `cyber-cyan`: #00f0ff (primary accent)
- `cyber-magenta`: #ff00aa (alerts, critical)
- `cyber-green`: #00ff88 (success)
- `cyber-amber`: #ffaa00 (warnings)
- `cyber-crimson`: #ff3366 (errors)

**Key Visual Elements:**
- Schematic cards with L-shaped corner brackets
- Scanline overlay effect
- Chromatic aberration on headers
- Animated gradient borders
- 3D neural polyhedron visualization
- Waveform activity indicators

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  repositories   │       │     reviews     │       │    findings     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │───┐   │ id (PK)         │
│ github_id       │   │   │ repository_id(FK)│◄──┘   │ review_id (FK)  │◄──┐
│ full_name       │   │   │ pr_number       │       │ agent_type      │   │
│ webhook_secret  │   │   │ pr_title        │       │ severity        │   │
│ created_at      │   │   │ commit_sha      │       │ file_path       │   │
└─────────────────┘   │   │ status          │       │ line_number     │   │
                      │   │ comment_id      │       │ title           │   │
┌─────────────────┐   │   │ created_at      │       │ description     │   │
│    settings     │   │   │ completed_at    │       │ suggestion      │   │
├─────────────────┤   │   └─────────────────┘       │ created_at      │   │
│ id (PK)         │   │           │                 └─────────────────┘   │
│ repository_id(FK)│◄──┘           │                         │            │
│ enabled         │               │                         │            │
│ agents_enabled  │               └─────────────────────────┴────────────┘
│ severity_threshold│
│ created_at      │
│ updated_at      │
└─────────────────┘
```

### Table Definitions

#### `repositories`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| github_id | INTEGER | GitHub's repository ID (unique) |
| full_name | TEXT | "owner/repo" format |
| webhook_secret | TEXT | Optional webhook secret |
| created_at | TIMESTAMP | Creation time |

#### `reviews`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| repository_id | UUID | Foreign key to repositories |
| pr_number | INTEGER | Pull request number |
| pr_title | TEXT | PR title |
| commit_sha | TEXT | Head commit SHA |
| status | TEXT | pending, processing, completed, failed |
| progress | INTEGER | Progress percentage (0-100) |
| current_stage | TEXT | Current processing stage |
| comment_id | INTEGER | GitHub comment ID (after posting) |
| created_at | TIMESTAMP | When review was created |
| completed_at | TIMESTAMP | When review finished |

#### `findings`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| review_id | UUID | Foreign key to reviews |
| agent_type | TEXT | logic, security, quality |
| severity | TEXT | critical, high, medium, low, info |
| confidence | TEXT | high, medium, low (default: medium) |
| file_path | TEXT | Path to affected file |
| line_number | INTEGER | Line number (optional) |
| title | TEXT | Brief issue title |
| description | TEXT | Detailed explanation |
| suggestion | TEXT | How to fix (optional) |
| is_false_positive | BOOLEAN | Marked as false positive |
| false_positive_reason | TEXT | Reason for false positive marking |
| created_at | TIMESTAMP | Creation time |

#### `settings`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| repository_id | UUID | Foreign key (unique) |
| enabled | BOOLEAN | Enable/disable reviews |
| agents_enabled | JSONB | {logic: bool, security: bool, quality: bool} |
| severity_threshold | TEXT | Minimum severity to report |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

---

## Agent System

### Overview

CodeGuard AI uses a multi-agent architecture where three specialized agents analyze code in parallel, followed by a Critique Agent that deduplicates findings and assigns confidence scores.

```
                    ┌─────────────────────┐
                    │  ReviewSupervisor   │
                    │    (LangGraph)      │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
      ┌───────────┐   ┌───────────┐   ┌───────────┐
      │  Logic    │   │ Security  │   │  Quality  │
      │  Agent    │   │  Agent    │   │  Agent    │
      └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
            │               │               │
            └───────────────┼───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Critique    │
                    │    Agent      │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Combine &   │
                    │    Format     │
                    └───────────────┘
```

### Agent Types

#### Logic Agent
**Purpose:** Detects bugs and logic errors that could cause runtime issues.

**Focus Areas:**
- Null/None checks (missing checks causing AttributeError)
- Off-by-one errors (incorrect loop bounds, slice indices)
- Type mismatches (operations on incompatible types)
- Unreachable code (dead code after return/break)
- Incorrect error handling (swallowed exceptions)
- Resource leaks (unclosed files, connections)
- Race conditions (thread safety issues)

#### Security Agent
**Purpose:** Identifies security vulnerabilities and unsafe practices.

**Focus Areas:**
- SQL Injection (unsanitized input in queries)
- Command Injection (user input in os.system, subprocess, eval)
- Cross-Site Scripting (XSS)
- Hardcoded Secrets (API keys, passwords in code)
- Path Traversal (user-controlled file paths)
- Insecure Deserialization (pickle, yaml.load on untrusted data)
- Authentication Issues (missing auth, weak passwords)
- Sensitive Data Exposure (logging secrets)
- SSRF Vulnerabilities

#### Quality Agent
**Purpose:** Reviews code maintainability and style compliance.

**Focus Areas:**
- PEP 8 Compliance (line length, naming, whitespace)
- Documentation (missing docstrings)
- Code Complexity (functions too long, deep nesting)
- Naming Conventions (unclear variable names)
- Type Hints (missing annotations)
- Code Duplication (repeated blocks)
- Magic Numbers/Strings (hardcoded values)
- Dead Code (unused imports, variables)

#### Critique Agent (New in Phase 7)
**Purpose:** Post-processes findings from all agents to improve quality.

**Functions:**
- **Deduplication:** Removes duplicate findings reported by multiple agents
- **Confidence Scoring:** Assigns confidence levels (high/medium/low) to each finding
- **Misattribution Fixes:** Corrects agent type if a finding was misclassified
- **Quality Filtering:** Removes low-confidence or false positive patterns

**Output:**
```json
{
  "logic_findings": [...],
  "security_findings": [...],
  "quality_findings": [...],
  "duplicates_removed": 3,
  "misattributions_fixed": 1,
  "summary": "Processed 15 findings, removed 3 duplicates"
}
```

### How Agents Work

1. **Prompt Construction:** Each agent has a template prompt in `prompts.py` with placeholders for `{diff}` and `{files}`.

2. **LLM Invocation:** The `BaseAgent.analyze()` method:
   - Formats the prompt with the PR diff
   - Calls `LLMService.invoke_structured()` with `AgentResponse` schema
   - Returns a list of `AgentFinding` objects

3. **Structured Output:** Gemini returns JSON matching the schema:
   ```json
   {
     "findings": [
       {
         "severity": "critical",
         "confidence": "high",
         "file_path": "src/auth.py",
         "line_number": 42,
         "title": "SQL Injection",
         "description": "User input passed directly to query",
         "suggestion": "Use parameterized queries"
       }
     ],
     "summary": "Found 1 critical security issue"
   }
   ```

4. **Parallel Execution:** LangGraph runs all three agents simultaneously using a StateGraph, then passes results to the Critique Agent for deduplication and confidence scoring, before combining and formatting.

5. **Confidence Levels:**
   - `high`: Very likely a real issue, clear evidence in code
   - `medium`: Probable issue, some uncertainty
   - `low`: Possible issue, needs human verification

### Severity Levels

| Level | Meaning | Example |
|-------|---------|---------|
| **critical** | Will cause crashes or security breaches | SQL injection, null pointer dereference |
| **warning** | Likely bugs, may not always manifest | Missing error handling, potential race condition |
| **info** | Suggestions and best practices | Missing type hints, long function |

### False Positive Handling

Users can mark findings as false positives via the API or UI:

```
PUT /api/findings/{finding_id}/false-positive
{
  "is_false_positive": true,
  "reason": "This is intentional for backward compatibility"
}
```

**Database fields:**
- `is_false_positive`: Boolean flag
- `false_positive_reason`: Optional explanation

**UI Integration:**
- FindingsByFile component shows "Mark as False Positive" button
- Toast notification confirms the action
- Finding is visually indicated as false positive

---

## Webhook Flow

### Complete Request Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. GITHUB EVENT                                                          │
│                                                                          │
│    Developer opens/updates PR on connected repository                    │
│    GitHub sends POST to configured webhook URL                           │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. WEBHOOK HANDLER (/api/webhook/github)                                 │
│                                                                          │
│    a. Verify HMAC-SHA256 signature (if secret configured)                │
│    b. Parse WebhookPayload from JSON body                                │
│    c. Filter: only "pull_request" events                                 │
│    d. Filter: only "opened" or "synchronize" actions                     │
│    e. Get or create Repository record                                    │
│    f. Create Review record (status: PENDING)                             │
│    g. Spawn background thread with job_data                              │
│    h. Return {"status": "processing", "review_id": "..."} immediately    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. BACKGROUND WORKER (process_review function)                           │
│                                                                          │
│    a. Update Review status: PENDING → PROCESSING                         │
│    b. Broadcast progress: "fetching_diff" (10%)                          │
│    c. Fetch PR diff from GitHub API                                      │
│    d. Extract file paths from diff using regex                           │
│    e. Check rate limit (15 requests/minute for Gemini)                   │
│       - If exceeded, retry up to 3 times with 5s delay                   │
│    f. Run ReviewSupervisor (LangGraph):                                  │
│       - Logic Agent analyzes diff (25%)                                  │
│       - Security Agent analyzes diff (40%) - parallel                    │
│       - Quality Agent analyzes diff (55%) - parallel                     │
│       - Critique Agent deduplicates & scores (70%)                       │
│       - Combine and format findings (85%)                                │
│    g. Map AgentFindings to database Findings (with confidence)           │
│    h. Batch insert findings to database                                  │
│    i. Broadcast progress: "posting_comment" (95%)                        │
│    j. Post formatted comment to GitHub PR                                │
│    k. Update Review: status → COMPLETED, store comment_id                │
│    l. Broadcast progress: "complete" (100%)                              │
│    m. On any error: status → FAILED, log traceback                       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. GITHUB COMMENT                                                        │
│                                                                          │
│    Formatted markdown comment appears on the PR with:                    │
│    - Summary header                                                      │
│    - Findings grouped by severity (Critical → Warning → Info)            │
│    - Each finding in collapsible <details> section                       │
│    - File path, line number, description, suggestion                     │
│    - Agent type badge                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Webhook Payload Structure

```json
{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "title": "Add user authentication",
    "head": {
      "sha": "abc123def456"
    }
  },
  "repository": {
    "id": 123456789,
    "full_name": "owner/repo"
  }
}
```

### Rate Limiting

Gemini has a rate limit of 15 requests per minute on the free tier. The system handles this with:

1. **Redis Sliding Window:** Track request counts per minute
2. **Pre-check:** Before running agents, check if quota available
3. **Retry Logic:** If rate limited, wait 5 seconds and retry (max 3 attempts)
4. **Post-increment:** After successful run, increment counter

### Redis Usage

**Status:** Redis (via Upstash) is **actively used** for rate limiting.

| Service | Purpose | Implementation |
|---------|---------|----------------|
| **RateLimiter** | Prevent Gemini API overuse | Sliding window counter with INCR/EXPIRE |
| **QueueService** | Job queue (available but not primary) | LPUSH/RPOP operations |

**Note:** While a Redis job queue exists (`QueueService`), the current implementation spawns background threads directly from the webhook handler for simplicity. Redis is primarily used for rate limiting the Gemini API calls.

---

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Application
ENVIRONMENT=development
DEBUG=false

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Supabase (PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Google AI (Gemini)
GOOGLE_API_KEY=AIzaSy...
LLM_MODEL=gemini-2.5-flash

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# LangSmith (Optional - Tracing)
LANGCHAIN_API_KEY=lsv2_...
LANGCHAIN_PROJECT=codeguard-ai
LANGCHAIN_TRACING_V2=true
```

### Vite Configuration

```typescript
// frontend/vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

---

## Key Design Patterns

### 1. Repository Pattern
Database operations are abstracted into repository classes (`RepositoryRepo`, `ReviewRepo`, etc.) that handle all Supabase interactions. This decouples business logic from data access.

### 2. Dependency Injection
FastAPI's `Depends()` is used throughout for injecting services:
```python
def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    return ReviewRepo(db)
```

### 3. Pydantic Models
All data is validated through Pydantic models, providing type safety and automatic serialization:
```python
class Finding(BaseModel):
    id: UUID
    severity: Severity
    title: str
    # ...
```

### 4. LangGraph StateGraph
Agents are orchestrated using LangGraph's StateGraph for parallel execution with a Critique phase:
```python
graph.add_node("logic", run_logic)
graph.add_node("security", run_security)
graph.add_node("quality", run_quality)
graph.add_node("critique", run_critique)
graph.add_node("combine", combine_findings)
graph.add_edge(START, "logic")
graph.add_edge(START, "security")
graph.add_edge(START, "quality")
graph.add_edge(["logic", "security", "quality"], "critique")
graph.add_edge("critique", "combine")
graph.add_edge("combine", END)
```

### 5. Background Threading
Webhooks return immediately while processing happens in a daemon thread:
```python
thread = threading.Thread(target=process_review, args=(job_data,), daemon=True)
thread.start()
return {"status": "processing"}
```

### 6. React Query Caching
Frontend uses TanStack Query for intelligent data fetching:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['reviews', page],
  queryFn: () => getReviews(page),
  refetchInterval: 30000,
})
```

---

## Real-Time Progress Tracking

Phase 7 introduced WebSocket-based real-time progress updates for review processing.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │◄────│  WebSocket      │◄────│    Worker       │
│  (React App)    │     │  Connection     │     │  (Processor)    │
│                 │     │  Manager        │     │                 │
│ useReviewProgress│     │                 │     │ broadcast_progress│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

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

### WebSocket Message Format

```json
{
  "stage": "logic_agent",
  "progress": 25,
  "message": "Running Logic Agent"
}
```

### Frontend Integration

The `useReviewProgress` hook connects to the WebSocket endpoint and provides real-time state:

```typescript
const { stage, progress, message, isConnected, isComplete } = useReviewProgress(reviewId)
```

### Connection Manager

The singleton `ConnectionManager` class handles:
- Multiple clients watching the same review
- Automatic cleanup on disconnect
- Thread-safe connection management
- Broadcast to all subscribers

---

## Running the Application

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Health Check

```bash
cd backend
python healthcheck.py
```

### Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/reviews` | List reviews (paginated) |
| GET | `/api/reviews/{id}` | Get review with findings |
| PUT | `/api/findings/{id}/false-positive` | Mark finding as false positive |
| GET | `/api/repositories` | List repositories |
| POST | `/api/repositories` | Create repository |
| GET | `/api/repositories/{id}` | Get repository |
| DELETE | `/api/repositories/{id}` | Delete repository |
| GET | `/api/repositories/{id}/settings` | Get settings |
| PUT | `/api/repositories/{id}/settings` | Update settings |
| GET | `/api/repositories/{id}/reviews` | Get repo's reviews |
| POST | `/api/webhook/github` | GitHub webhook handler |
| WS | `/ws/reviews/{id}` | WebSocket for real-time progress |
