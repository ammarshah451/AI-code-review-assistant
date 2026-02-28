# CodeGuard AI

A multi-agent system that acts as an automated first-pass reviewer for GitHub pull requests. It analyzes Python code for logic errors, security vulnerabilities, and code quality issues using specialized AI agents, then posts findings as PR comments.

## Architecture

```
GitHub Webhook (PR Created/Updated)
            |
            v
      FastAPI Backend
            |
            v
      Supervisor Agent
            |
            v
   +--------+--------+
   v        v        v
Logic   Security  Quality
Agent    Agent    Agent
   +--------+--------+
            |
            v
      Critique Loop
  (Cross-agent validation)
            |
            v
    GitHub PR Comment
```

**Supervisor Agent** orchestrates the review by delegating to three specialized agents:

- **Logic Agent** - Detects bugs, edge cases, off-by-one errors, and incorrect logic
- **Security Agent** - Finds vulnerabilities like SQL injection, XSS, hardcoded secrets, and insecure patterns
- **Quality Agent** - Reviews code style, complexity, naming conventions, and maintainability

A **Critique Loop** cross-validates findings between agents to reduce false positives before posting results.

## Tech Stack

### Backend
- **FastAPI** - Async REST API with WebSocket support
- **LangGraph** - Multi-agent orchestration framework
- **Gemini 2.5 Flash** - LLM for code analysis
- **Supabase** (PostgreSQL) - Database for reviews, findings, and settings
- **Upstash Redis** - Job queue and rate limiting
- **LangSmith** - Agent tracing and monitoring

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Three.js** / React Three Fiber - 3D dashboard visualizations
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **TanStack Query** - Data fetching

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Supabase project
- Google AI API key (Gemini)
- GitHub Personal Access Token

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Fill in your .env values
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase service role key |
| `GOOGLE_API_KEY` | Yes | Google AI Studio API key |
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo` scope |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL (async jobs) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |
| `LANGCHAIN_API_KEY` | No | LangSmith API key (tracing) |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/webhooks/github` | GitHub webhook receiver |
| `GET` | `/api/reviews` | List reviews |
| `GET` | `/api/reviews/{id}` | Get review details |
| `GET` | `/api/repositories` | List repositories |
| `GET` | `/api/stats` | Dashboard statistics |
| `WS` | `/ws/reviews/{id}` | Real-time review progress |

Full API docs available at `/docs` when the server is running.

## Running Tests

```bash
cd backend
pytest
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── agents/          # LangGraph agents (logic, security, quality, critique)
│   │   ├── api/             # FastAPI route handlers
│   │   ├── db/              # Supabase database layer
│   │   ├── models/          # Pydantic models
│   │   ├── services/        # GitHub, LLM, queue, WebSocket services
│   │   ├── utils/           # Utilities
│   │   ├── worker/          # Background job processor
│   │   ├── config.py        # Settings & environment config
│   │   └── main.py          # FastAPI app entry point
│   └── tests/               # Test suite
├── frontend/
│   └── src/
│       ├── components/      # UI components (including 3D visualizations)
│       ├── pages/           # Route pages
│       ├── hooks/           # Custom React hooks
│       ├── context/         # React context providers
│       ├── api/             # API client
│       └── types/           # TypeScript type definitions
└── docs/
    └── plans/               # Implementation phase plans
```

## License

MIT
