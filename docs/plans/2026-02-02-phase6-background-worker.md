# Phase 6: Background Worker Design

> **Date:** 2026-02-02
> **Status:** Approved
> **Author:** Claude + User

## Overview

Implement background processing for PR reviews using a thread-based approach. When a GitHub webhook arrives, spawn a background thread to process the review while returning immediately to GitHub.

## Context

### Current State
- Webhook receives PR event → Creates Review record → Enqueues to Redis → Returns
- Nothing processes the Redis queue (gap)

### Decision
Use **synchronous processing with background thread** (Option A2a) because:
- Zero additional infrastructure cost (no second Railway service)
- No Redis polling (saves Upstash free tier quota)
- Code stays modular and production-ready
- Easy to extract to a real worker later if needed
- Sufficient for portfolio/personal use

## Architecture

```
GitHub Webhook
      ↓
Webhook Handler (webhooks.py)
      ├── Validate signature
      ├── Create Review record (status: pending)
      ├── Spawn background thread ─────→ process_review()
      └── Return {"status": "processing"}        ↓
                                           1. Update status → "processing"
                                           2. Fetch PR diff from GitHub
                                           3. Extract file paths
                                           4. Check rate limit
                                           5. Run ReviewSupervisor
                                           6. Save findings to DB
                                           7. Post comment to GitHub
                                           8. Update status → "completed"
                                           (on error → "failed")
```

## File Changes

### New Files

#### `app/worker/__init__.py`
```python
"""Background worker for processing PR reviews."""

from app.worker.processor import process_review

__all__ = ["process_review"]
```

#### `app/worker/processor.py`
Core processing function with:
- All review processing logic
- Error handling with status updates
- Rate limiting integration
- Logging for debugging

### Modified Files

#### `app/api/webhooks.py`
- Remove: `queue.enqueue_review()` call
- Remove: `QueueService` dependency
- Add: `threading` import
- Add: Thread spawning with `daemon=True`

## Detailed Design

### `process_review(job_data: dict)`

**Input:**
```python
{
    "review_id": "uuid-string",
    "owner": "username",
    "repo": "repo-name",
    "pr_number": 123,
    "commit_sha": "abc123"
}
```

**Flow:**
1. Initialize services (GitHubService, ReviewSupervisor, DB repos)
2. Update review status to "processing"
3. Fetch PR diff using GitHubService
4. Parse diff to extract file paths
5. Check rate limit (RateLimiter.can_proceed)
6. If rate limited, sleep and retry (max 3 attempts)
7. Run ReviewSupervisor.run(diff, files)
8. Map agent findings to database Finding models
9. Save findings using FindingRepo.create_many()
10. Format comment and post to GitHub
11. Update review with comment_id and status "completed"

**Error Handling:**
- Wrap entire flow in try/except
- On any exception: Update review status to "failed"
- Log error with traceback for debugging
- Don't re-raise (thread should exit gracefully)

### Webhook Changes

**Before:**
```python
job_id = str(uuid4())
queue.enqueue_review(job_id=job_id, data={...})
return {"status": "queued", "job_id": job_id}
```

**After:**
```python
job_data = {...}
thread = threading.Thread(target=process_review, args=(job_data,), daemon=True)
thread.start()
return {"status": "processing", "review_id": str(review.id)}
```

## Rate Limiting

The existing `RateLimiter` class will be used:
- Check `can_proceed("gemini")` before running agents
- If blocked, sleep for 5 seconds and retry
- Max 3 retry attempts before marking review as failed
- Increment counter after successful agent run

## Mapping Agent Findings to Database

Agent findings use different field names than database:

| Agent Finding | Database Finding |
|---------------|------------------|
| `severity` ("critical", "warning", "info") | `severity` ("critical", "high", "medium", "low", "info") |
| `file_path` | `file_path` |
| `line_number` | `line_start` |
| `title` | `title` |
| `description` | `description` |
| `suggestion` | `suggestion` |
| (from agent type) | `agent_type` |

Mapping function needed for severity:
- "critical" → "critical"
- "warning" → "medium"
- "info" → "info"

## Testing

### Unit Tests (`tests/test_worker.py`)

1. `test_process_review_success` - Happy path with mocked services
2. `test_process_review_github_error` - GitHub API fails, status → failed
3. `test_process_review_agent_error` - Agent fails, status → failed
4. `test_process_review_rate_limited` - Verify retry logic
5. `test_severity_mapping` - Verify agent→DB severity conversion

### Manual Testing

1. Start backend: `python -m uvicorn app.main:app --reload`
2. Create PR on test repo with bad code:
   ```python
   def bad_code(user_input):
       return eval(user_input)  # Security issue
   ```
3. Check dashboard for review status progression: pending → processing → completed
4. Verify comment appears on GitHub PR
5. Verify findings saved in database

## Future Migration Path

When ready to scale to a real worker:

1. Create `app/worker/__main__.py` with polling loop
2. Change webhook back to `queue.enqueue_review()`
3. Deploy worker as separate Railway service
4. `process_review()` stays unchanged

Estimated effort: 30 minutes.

## Dependencies

No new dependencies required. Uses existing:
- `threading` (Python stdlib)
- `GitHubService`
- `ReviewSupervisor`
- `RateLimiter`
- Database repos

## Success Criteria

- [ ] PR webhook triggers background processing
- [ ] Review status updates: pending → processing → completed
- [ ] Findings saved to database
- [ ] Comment posted to GitHub PR
- [ ] Failed reviews show status "failed"
- [ ] Rate limiting prevents Gemini quota exhaustion
- [ ] All new tests pass
- [ ] Existing 139 tests still pass
