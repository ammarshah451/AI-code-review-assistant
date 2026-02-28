# Phase 7: UI/UX Improvements, WebSocket Progress, Agent Quality & Workflow Enhancements

## Overview

This phase implements comprehensive improvements to CodeGuard AI including real-time progress tracking via WebSockets, a Critique Agent for better finding quality, UI/UX enhancements, and workflow improvements like false positive marking.

---

## 1. WebSocket Progress Tracking

### Architecture

```
Frontend (React)                    Backend (FastAPI)
      │                                   │
      │──── WS Connect ──────────────────►│
      │     /ws/reviews/{review_id}       │
      │                                   │
      │◄─── Progress Update ──────────────│
      │     {stage: "logic_agent",        │
      │      progress: 30,                │
      │      message: "Analyzing..."}     │
      │                                   │
      │◄─── Progress Update ──────────────│
      │     {stage: "complete",           │
      │      progress: 100}               │
      │                                   │
      │──── WS Disconnect ────────────────│
```

### Progress Stages (8 steps)

| Stage | Progress | Message |
|-------|----------|---------|
| `fetching_diff` | 10% | Fetching PR diff from GitHub |
| `logic_agent` | 25% | Running Logic Agent |
| `security_agent` | 40% | Running Security Agent |
| `quality_agent` | 55% | Running Quality Agent |
| `critique_agent` | 70% | Running Critique Agent |
| `deduplicating` | 80% | Deduplicating findings |
| `formatting` | 90% | Formatting comment |
| `posting` | 95% | Posting to GitHub |
| `complete` | 100% | Review complete |

### Backend Implementation

**New file: `app/services/websocket.py`**
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, review_id: str, websocket: WebSocket)
    async def disconnect(self, review_id: str, websocket: WebSocket)
    async def broadcast(self, review_id: str, data: dict)
```

**New endpoint: `/ws/reviews/{review_id}`**
- Accepts WebSocket connection
- Adds to ConnectionManager
- Keeps connection alive until review completes or client disconnects

**Worker changes:**
- Import `ConnectionManager` singleton
- Call `manager.broadcast()` at each stage
- Update `reviews.progress` and `reviews.current_stage` in database

### Frontend Implementation

**New hook: `useReviewProgress(reviewId)`**
```typescript
const { progress, stage, message, isConnected } = useReviewProgress(reviewId)
```

**New component: `ProgressBar`**
- Sticky bar at top of page
- Shows when any review is processing
- Animated gradient matching cyber theme
- Auto-dismisses on complete

---

## 2. Critique Agent

### Purpose

Reviews findings from Logic, Security, and Quality agents to:
1. Remove duplicate findings
2. Fix misattributed findings (move to correct agent category)
3. Assign confidence scores (high/medium/low)
4. Filter obvious false positives

### Data Flow

```
Logic Agent ──────┐
                  │
Security Agent ───┼───► Critique Agent ───► Final Findings
                  │
Quality Agent ────┘
```

### Prompt Design

```
You are a Critique Agent for CodeGuard AI. Your job is to review findings
from other agents and improve their quality.

## Input Findings

LOGIC FINDINGS:
{logic_findings}

SECURITY FINDINGS:
{security_findings}

QUALITY FINDINGS:
{quality_findings}

## Your Tasks

1. **Remove Duplicates**: If multiple agents reported the same issue, keep
   only the best-written one in the most appropriate category.

2. **Fix Misattributions**: If a finding is in the wrong category, move it.
   - Security issues (injection, XSS, secrets) → Security
   - Logic bugs (null checks, off-by-one) → Logic
   - Style/maintainability → Quality

3. **Assign Confidence**: Rate each finding:
   - high: Clear-cut issue, definitely a problem
   - medium: Likely an issue, but context-dependent
   - low: Possible issue, might be intentional

4. **Filter False Positives**: Remove findings that are clearly not issues
   (e.g., test files, intentional patterns, framework-specific code)

## Output Format

Return a CritiqueResponse with cleaned findings for each category.
```

### Schema Changes

**AgentFinding (updated):**
```python
class AgentFinding(BaseModel):
    severity: Literal["critical", "warning", "info"]
    confidence: Literal["high", "medium", "low"] = "medium"
    file_path: str
    line_number: Optional[int] = None
    title: str
    description: str
    suggestion: Optional[str] = None
```

**CritiqueResponse:**
```python
class CritiqueResponse(BaseModel):
    logic_findings: List[AgentFinding]
    security_findings: List[AgentFinding]
    quality_findings: List[AgentFinding]
    duplicates_removed: int
    misattributions_fixed: int
```

---

## 3. UI Improvements

### 3.1 Progress Bar

```
┌─────────────────────────────────────────────────────────────┐
│  ⟳ Reviewing PR #42...  [████████░░░░░░░░] 50%              │
│    Running Security Agent                                    │
└─────────────────────────────────────────────────────────────┘
```

- Position: Fixed at top of viewport
- Visibility: Only when a review is processing
- Animation: Gradient flow matching cyber theme
- Interaction: Click to go to review page

### 3.2 Toast Notifications

- Position: Bottom-right corner
- Types: Success (green), Error (red), Info (cyan)
- Content: "✓ Review completed for PR #42 - 5 findings"
- Behavior: Auto-dismiss after 5s, click to navigate
- Stack: Up to 3 toasts visible

### 3.3 Recent Activity Feed (Dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  RECENT ACTIVITY                                             │
├─────────────────────────────────────────────────────────────┤
│  ● PR #42 review completed                           2m ago  │
│  ○ PR #41 review started                             5m ago  │
│  ● Repository connected: ammarshah451/app           10m ago  │
│  ✕ PR #40 review failed                             15m ago  │
└─────────────────────────────────────────────────────────────┘
```

- Shows last 10 events
- Real-time updates via WebSocket
- Event types: review_started, review_completed, review_failed, repo_connected

### 3.4 Findings Grouped by File

```
📁 src/auth/login.py (3 issues)
  ├─ 🔴 SQL Injection [Security] [High]
  │     User input passed directly to query...
  │     [Copy Suggestion] [Mark False Positive]
  │
  ├─ 🟡 Missing type hints [Quality] [Medium]
  └─ 🟡 No error handling [Logic] [Low]

📁 src/utils/helpers.py (1 issue)
  └─ 🟡 Function too complex [Quality] [High]
```

- Collapsible file sections (expanded by default)
- Severity icon + agent badge + confidence badge
- Copy suggestion button
- Mark false positive button

---

## 4. Workflow Improvements

### 4.1 Confidence Scores

Each finding displays confidence level:
- **High** (green badge): Clear-cut issue
- **Medium** (yellow badge): Likely issue
- **Low** (gray badge): Possible issue

Users can filter by confidence level.

### 4.2 False Positive Marking

**UI Flow:**
1. User clicks "Mark as False Positive" on a finding
2. Modal appears with optional reason field
3. Finding is marked and styled with strike-through
4. Finding excluded from counts/stats

**API Endpoint:**
```
PUT /api/findings/{id}/false-positive
{
  "is_false_positive": true,
  "reason": "This is test code, intentionally unsafe"
}
```

---

## 5. Database Schema Changes

```sql
-- Reviews table: Add progress tracking
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS current_stage text;

-- Findings table: Add confidence and false positive fields
ALTER TABLE findings ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'medium';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS is_false_positive boolean DEFAULT false;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS false_positive_reason text;
```

---

## 6. New Dependencies

**Backend:**
```
websockets>=12.0
```

**Frontend:**
```
# No new dependencies - using native WebSocket API
```

---

## 7. File Changes Summary

### Backend (New Files)
- `app/services/websocket.py` - WebSocket connection manager
- `app/agents/critique.py` - Critique Agent implementation

### Backend (Modified Files)
- `app/main.py` - Add WebSocket endpoint
- `app/worker/processor.py` - Add progress broadcasting
- `app/agents/supervisor.py` - Integrate Critique Agent
- `app/agents/schemas.py` - Add confidence field, CritiqueResponse
- `app/api/reviews.py` - Add false positive endpoint
- `app/db/repositories.py` - Add false positive methods

### Frontend (New Files)
- `src/hooks/useWebSocket.ts` - WebSocket hook
- `src/hooks/useReviewProgress.ts` - Progress tracking hook
- `src/components/ProgressBar.tsx` - Global progress bar
- `src/components/Toast.tsx` - Toast notification system
- `src/components/ActivityFeed.tsx` - Recent activity component
- `src/components/FindingsByFile.tsx` - Grouped findings view

### Frontend (Modified Files)
- `src/App.tsx` - Add ProgressBar and Toast providers
- `src/pages/Dashboard.tsx` - Add ActivityFeed
- `src/pages/ReviewDetail.tsx` - Use FindingsByFile, add false positive UI
- `src/types/index.ts` - Add new types

---

## 8. Testing Plan

### Backend Tests
- WebSocket connection/disconnection
- Progress broadcasting
- Critique Agent deduplication logic
- False positive API endpoint

### Frontend Tests
- WebSocket hook reconnection
- Progress bar visibility states
- Toast notification stacking
- Finding collapse/expand

### Integration Tests
- Full review flow with progress updates
- False positive marking persists
- Activity feed updates in real-time
