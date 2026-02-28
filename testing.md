# CodeGuard AI - Testing Guide

> This guide walks you through testing all components of CodeGuard AI to understand how the system works end-to-end.

## Prerequisites

Before testing, ensure you have:

1. **Backend dependencies installed**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Frontend dependencies installed**:
   ```bash
   cd frontend
   npm install
   ```

3. **Environment configured** - `backend/.env` file with:
   - `SUPABASE_URL` and `SUPABASE_KEY` (service_role key)
   - `GOOGLE_API_KEY` (Gemini API)
   - `GITHUB_TOKEN` (fine-grained PAT)
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - `LANGCHAIN_API_KEY` (optional, for tracing)

---

## Test 1: Unit Tests (Backend)

Run the full test suite to verify all components work correctly:

```bash
cd backend
python -m pytest tests/ -v
```

**Expected output**: `157 passed`

### What's being tested:
| Component | Tests |
|-----------|-------|
| Agent Schemas | Pydantic models for findings/responses |
| API Endpoints | Reviews, Repositories, Stats, Webhooks |
| Database Repos | CRUD operations for all tables |
| GitHub Service | PR diff fetching, comment posting |
| LLM Service | Gemini invocation, structured output |
| Queue Service | Redis job enqueue/dequeue |
| Formatter | GitHub comment markdown generation |
| **Worker** | Background processing, severity mapping, error handling |

---

## Test 2: Database Connectivity

Verify Supabase connection works:

```bash
cd backend
python -c "
from app.db import get_db

db = get_db()
for table in ['repositories', 'reviews', 'findings', 'settings']:
    result = db.table(table).select('count', count='exact').execute()
    print(f'{table}: OK (count: {result.count})')
"
```

**Expected output**:
```
repositories: OK (count: 0)
reviews: OK (count: 0)
findings: OK (count: 0)
settings: OK (count: 0)
```

---

## Test 3: LLM Service (Gemini)

Test that Gemini 2.5 Flash is working:

```bash
cd backend
python -c "
from app.services.llm import LLMService

llm = LLMService()
print(f'Model: {llm.model}')
response = llm.invoke('What is 2+2? Reply with just the number.')
print(f'Response: {response}')
"
```

**Expected output**:
```
Model: gemini-2.5-flash
Response: 4
```

---

## Test 4: GitHub Service

Test GitHub API connectivity:

```bash
cd backend
python -c "
from app.services.github import GitHubService

gh = GitHubService()
# Fetch a public test PR
diff = gh.get_pr_diff('octocat', 'Hello-World', 1)
print(f'Successfully fetched diff ({len(diff)} chars)')
print(diff[:200])
"
```

**Expected output**: A diff preview from the test repository.

---

## Test 5: Redis Queue

Test Upstash Redis connectivity:

```bash
cd backend
python -c "
from app.services.queue import QueueService, get_redis_client

redis = get_redis_client()
queue = QueueService(redis)

# Enqueue a test job
queue.enqueue_review('test-job', {'pr_number': 1})
print(f'Queue length: {queue.queue_length()}')

# Dequeue and verify
job = queue.dequeue_review()
print(f'Dequeued job: {job[\"job_id\"]}')
print('Redis: OK')
"
```

**Expected output**:
```
Queue length: 1
Dequeued job: test-job
Redis: OK
```

---

## Test 6: Full Agent Pipeline (End-to-End)

This is the core test - running all three agents on vulnerable code:

```bash
cd backend
python -c "
from app.agents.supervisor import ReviewSupervisor

supervisor = ReviewSupervisor()

# Intentionally vulnerable Python code
test_diff = '''
diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
@@ -1,5 +1,15 @@
+import os
+import subprocess
+
 def process_user_input(user_data):
-    return user_data
+    # Execute user command - SECURITY ISSUE
+    result = subprocess.call(user_data, shell=True)
+
+    # Hardcoded password - SECURITY ISSUE
+    password = \"admin123\"
+
+    # Eval on user input - SECURITY ISSUE
+    return eval(user_data)
'''

print('Running code review...')
result = supervisor.run(test_diff, ['app.py'])

print(f'\n=== REVIEW RESULTS ===')
print(f'Logic findings: {len(result[\"logic_findings\"])}')
print(f'Security findings: {len(result[\"security_findings\"])}')
print(f'Quality findings: {len(result[\"quality_findings\"])}')

print('\n=== ALL FINDINGS ===')
all_findings = result['logic_findings'] + result['security_findings'] + result['quality_findings']
for f in all_findings:
    print(f'  [{f.severity.upper()}] {f.title}')

print('\n=== GITHUB COMMENT PREVIEW ===')
print(result['final_comment'][:1000])
"
```

**Expected output**:
- Multiple findings for command injection, eval(), hardcoded password
- Formatted GitHub comment with severity groupings

---

## Test 7: Worker Module

Test the background worker functions:

```bash
cd backend
python -c "
from app.worker.processor import (
    map_agent_severity,
    map_agent_type,
    extract_files_from_diff,
)
from app.models.finding import Severity, AgentType

# Test severity mapping
print('=== Severity Mapping ===')
print(f'critical -> {map_agent_severity(\"critical\")}')
print(f'warning -> {map_agent_severity(\"warning\")}')
print(f'info -> {map_agent_severity(\"info\")}')

# Test agent type mapping
print('\n=== Agent Type Mapping ===')
print(f'logic -> {map_agent_type(\"logic\")}')
print(f'security -> {map_agent_type(\"security\")}')
print(f'quality -> {map_agent_type(\"quality\")}')

# Test diff parsing
print('\n=== Diff Parsing ===')
test_diff = '''diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
diff --git a/utils/helper.py b/utils/helper.py
--- a/utils/helper.py
+++ b/utils/helper.py
'''
files = extract_files_from_diff(test_diff)
print(f'Extracted files: {files}')

print('\nWorker module: OK')
"
```

**Expected output**:
```
=== Severity Mapping ===
critical -> Severity.CRITICAL
warning -> Severity.MEDIUM
info -> Severity.INFO

=== Agent Type Mapping ===
logic -> AgentType.LOGIC
security -> AgentType.SECURITY
quality -> AgentType.QUALITY

=== Diff Parsing ===
Extracted files: ['app.py', 'utils/helper.py']

Worker module: OK
```

---

## Test 8: API Server

Start the backend and test API endpoints:

### Terminal 1 - Start server:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### Terminal 2 - Test endpoints:

```bash
# Health check
curl http://localhost:8000/

# Dashboard stats
curl http://localhost:8000/api/stats

# List repositories
curl http://localhost:8000/api/repositories

# List reviews
curl http://localhost:8000/api/reviews
```

**Expected**: JSON responses with data (empty arrays initially)

---

## Test 9: Webhook with Background Processing

This is the full end-to-end test simulating a GitHub webhook that triggers background processing:

```bash
cd backend
python -c "
import hmac
import hashlib
import json
import time
from fastapi.testclient import TestClient
from app.main import app
from app.db import get_db
from app.db.repositories import ReviewRepo

client = TestClient(app)

# Simulate webhook payload
payload = {
    'action': 'opened',
    'number': 42,
    'pull_request': {
        'title': 'Add new feature',
        'head': {'sha': 'abc123def456'}
    },
    'repository': {
        'id': 999888777,
        'full_name': 'test-user/webhook-test'
    }
}

# Create signature
secret = ''  # Empty secret for testing (or use your GITHUB_WEBHOOK_SECRET)
body = json.dumps(payload).encode()
signature = 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

# Send webhook
response = client.post(
    '/api/webhook/github',
    content=body,
    headers={
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'pull_request'
    }
)

print(f'Webhook Response: {response.status_code}')
print(f'Response Body: {response.json()}')

# The response should show 'processing' status
# Background thread is now running the review
"
```

**Expected output**:
```
Webhook Response: 200
Response Body: {'status': 'processing', 'review_id': '<uuid>'}
```

**Note**: The review is processed in a background thread. Check the database after a few seconds to see:
- Review status changed from `pending` → `processing` → `completed`
- Findings saved to the findings table

---

## Test 10: Frontend

Start the frontend development server:

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### What to verify:
1. **Boot sequence** - Cyber-noir animation plays on first visit
2. **Dashboard** - Shows stats cards (will be zeros initially)
3. **Neural Polyhedron** - 3D rotating wireframe in sidebar
4. **Command Palette** - Press `Ctrl+K` to open
5. **Reviews page** - Lists reviews (shows any completed reviews)
6. **Repositories page** - Lists repos
7. **Settings page** - Configuration toggles

---

## Test 11: LangSmith Tracing (Optional)

If you have LangSmith configured, check traces:

1. Go to https://smith.langchain.com
2. Select project `codeguard-ai`
3. You should see traces for each agent run with:
   - Input prompts
   - Output findings
   - Token usage
   - Latency

---

## Complete PR Review Flow (Architecture)

Here's what happens when a real PR is reviewed:

```
1. GitHub sends webhook → /api/webhook/github
                              ↓
2. Webhook handler validates signature
                              ↓
3. Creates Review record (status: pending)
                              ↓
4. Spawns background thread
                              ↓
5. Returns {"status": "processing"} immediately
                              ↓
   [Background Thread]
                              ↓
6. Updates Review (status: processing)
                              ↓
7. Fetches PR diff from GitHub API
                              ↓
8. Checks rate limit (retries if needed)
                              ↓
9. ReviewSupervisor runs agents in parallel:
   ├── LogicAgent    → Finds logic bugs
   ├── SecurityAgent → Finds vulnerabilities
   └── QualityAgent  → Finds code smells
                              ↓
10. Saves Findings to database
                              ↓
11. CommentFormatter combines findings
                              ↓
12. Posts comment to GitHub PR
                              ↓
13. Updates Review (status: completed)
```

---

## Troubleshooting

### "Google API key is required"
→ Check `GOOGLE_API_KEY` in `.env`

### "404 model not found"
→ Update `LLM_MODEL` to `gemini-2.5-flash`

### Database returns 500 errors
→ Verify `SUPABASE_KEY` is the **service_role** key, not anon

### Redis connection failed
→ Check `UPSTASH_REDIS_REST_URL` and token are correct

### GitHub API returns 401
→ Check `GITHUB_TOKEN` has correct permissions

### Review stuck in "processing" status
→ Check backend logs for errors in the background thread
→ Verify Gemini API quota hasn't been exceeded

---

## Summary

| Component | Status | Test Command |
|-----------|--------|--------------|
| Unit Tests | 157 passing | `pytest tests/ -v` |
| Database | Configured | Connection test |
| LLM (Gemini) | 2.5 Flash | Invoke test |
| GitHub API | Connected | Diff fetch test |
| Redis Queue | Connected | Enqueue/dequeue test |
| Agent Pipeline | Working | Full review test |
| Worker Module | Working | Function tests |
| Background Processing | Working | Webhook test |
| API Server | Running | `uvicorn app.main:app` |
| Frontend | Building | `npm run dev` |
| LangSmith | Optional | Check traces |

All core functionality is working!
