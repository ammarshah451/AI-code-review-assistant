# Phase 2: GitHub Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable CodeGuard AI to receive GitHub webhook events for PR creation and interact with the GitHub API to fetch PR data and post review comments.

**Architecture:** Create a webhook endpoint that verifies GitHub signatures and handles `pull_request` events. Build a GitHub service client using `httpx` for API calls (fetching diffs, posting comments). Use the existing queue service to enqueue review jobs for async processing.

**Tech Stack:** FastAPI, httpx, hmac (for signature verification), existing Pydantic models and repository pattern

---

## Prerequisites

Before starting:
1. Phase 1 must be complete (database, queue, models)
2. GitHub App created with webhook URL pointing to your backend
3. Environment variables set: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`

---

## Task 1: Create GitHub Service Client

**Files:**
- Create: `backend/app/services/github.py`
- Modify: `backend/app/services/__init__.py`
- Create: `backend/tests/test_github_service.py`

**Step 1: Write failing test for GitHub client**

```python
# backend/tests/test_github_service.py
"""Tests for GitHub service client."""

import pytest
from unittest.mock import MagicMock, patch

from app.services.github import GitHubService


class TestGitHubService:
    """Tests for GitHubService."""

    def test_init_with_token(self):
        """Test client initialization with token."""
        service = GitHubService(token="test-token")
        assert service.token == "test-token"
        assert "Authorization" in service.headers

    def test_get_pr_url(self):
        """Test PR API URL construction."""
        service = GitHubService(token="test-token")
        url = service._get_pr_url("owner", "repo", 123)
        assert url == "https://api.github.com/repos/owner/repo/pulls/123"

    @patch("app.services.github.httpx.Client")
    def test_get_pr_diff(self, mock_client_class):
        """Test fetching PR diff."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "diff --git a/file.py b/file.py\n+new line"
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
        mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

        service = GitHubService(token="test-token")
        diff = service.get_pr_diff("owner", "repo", 123)

        assert "diff --git" in diff
        mock_client.get.assert_called_once()

    @patch("app.services.github.httpx.Client")
    def test_get_pr_files(self, mock_client_class):
        """Test fetching PR files."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"filename": "src/main.py", "status": "modified", "patch": "+code"},
            {"filename": "src/utils.py", "status": "added", "patch": "+new"},
        ]
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
        mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

        service = GitHubService(token="test-token")
        files = service.get_pr_files("owner", "repo", 123)

        assert len(files) == 2
        assert files[0]["filename"] == "src/main.py"

    @patch("app.services.github.httpx.Client")
    def test_post_comment(self, mock_client_class):
        """Test posting PR comment."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": 12345, "body": "Test comment"}
        mock_client.post.return_value = mock_response
        mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
        mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

        service = GitHubService(token="test-token")
        comment = service.post_comment("owner", "repo", 123, "Test comment")

        assert comment["id"] == 12345
        mock_client.post.assert_called_once()

    @patch("app.services.github.httpx.Client")
    def test_update_comment(self, mock_client_class):
        """Test updating PR comment."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": 12345, "body": "Updated comment"}
        mock_client.patch.return_value = mock_response
        mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
        mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

        service = GitHubService(token="test-token")
        comment = service.update_comment("owner", "repo", 12345, "Updated comment")

        assert comment["body"] == "Updated comment"
        mock_client.patch.assert_called_once()
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_github_service.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.services.github'"

**Step 3: Create GitHub service implementation**

```python
# backend/app/services/github.py
"""GitHub API client for PR operations."""

from typing import Any, Dict, List, Optional

import httpx

from app.config import settings


class GitHubService:
    """GitHub API client for fetching PR data and posting comments."""

    BASE_URL = "https://api.github.com"
    ACCEPT_JSON = "application/vnd.github.v3+json"
    ACCEPT_DIFF = "application/vnd.github.v3.diff"

    def __init__(self, token: Optional[str] = None):
        """Initialize GitHub client with authentication token."""
        self.token = token or settings.github_private_key
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": self.ACCEPT_JSON,
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_pr_url(self, owner: str, repo: str, pr_number: int) -> str:
        """Construct PR API URL."""
        return f"{self.BASE_URL}/repos/{owner}/{repo}/pulls/{pr_number}"

    def _get_issues_url(self, owner: str, repo: str, pr_number: int) -> str:
        """Construct issues API URL (for comments)."""
        return f"{self.BASE_URL}/repos/{owner}/{repo}/issues/{pr_number}"

    def _get_comments_url(self, owner: str, repo: str) -> str:
        """Construct issue comments API URL."""
        return f"{self.BASE_URL}/repos/{owner}/{repo}/issues/comments"

    def get_pr_diff(self, owner: str, repo: str, pr_number: int) -> str:
        """Fetch PR diff as unified diff text.

        Args:
            owner: Repository owner
            repo: Repository name
            pr_number: Pull request number

        Returns:
            Unified diff string
        """
        url = self._get_pr_url(owner, repo, pr_number)
        headers = {**self.headers, "Accept": self.ACCEPT_DIFF}

        with httpx.Client() as client:
            response = client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.text

    def get_pr_files(
        self, owner: str, repo: str, pr_number: int
    ) -> List[Dict[str, Any]]:
        """Fetch list of files changed in PR.

        Args:
            owner: Repository owner
            repo: Repository name
            pr_number: Pull request number

        Returns:
            List of file objects with filename, status, patch, etc.
        """
        url = f"{self._get_pr_url(owner, repo, pr_number)}/files"

        with httpx.Client() as client:
            response = client.get(url, headers=self.headers, timeout=30.0)
            response.raise_for_status()
            return response.json()

    def get_pr_info(self, owner: str, repo: str, pr_number: int) -> Dict[str, Any]:
        """Fetch PR metadata.

        Args:
            owner: Repository owner
            repo: Repository name
            pr_number: Pull request number

        Returns:
            PR object with title, body, head, base, etc.
        """
        url = self._get_pr_url(owner, repo, pr_number)

        with httpx.Client() as client:
            response = client.get(url, headers=self.headers, timeout=30.0)
            response.raise_for_status()
            return response.json()

    def post_comment(
        self, owner: str, repo: str, pr_number: int, body: str
    ) -> Dict[str, Any]:
        """Post a comment on a PR.

        Args:
            owner: Repository owner
            repo: Repository name
            pr_number: Pull request number
            body: Comment body (markdown supported)

        Returns:
            Created comment object with id, body, etc.
        """
        url = f"{self._get_issues_url(owner, repo, pr_number)}/comments"

        with httpx.Client() as client:
            response = client.post(
                url,
                headers=self.headers,
                json={"body": body},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    def update_comment(
        self, owner: str, repo: str, comment_id: int, body: str
    ) -> Dict[str, Any]:
        """Update an existing comment.

        Args:
            owner: Repository owner
            repo: Repository name
            comment_id: Comment ID to update
            body: New comment body

        Returns:
            Updated comment object
        """
        url = f"{self._get_comments_url(owner, repo)}/{comment_id}"

        with httpx.Client() as client:
            response = client.patch(
                url,
                headers=self.headers,
                json={"body": body},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    def delete_comment(self, owner: str, repo: str, comment_id: int) -> bool:
        """Delete a comment.

        Args:
            owner: Repository owner
            repo: Repository name
            comment_id: Comment ID to delete

        Returns:
            True if deleted successfully
        """
        url = f"{self._get_comments_url(owner, repo)}/{comment_id}"

        with httpx.Client() as client:
            response = client.delete(url, headers=self.headers, timeout=30.0)
            return response.status_code == 204
```

**Step 4: Update services __init__.py**

```python
# backend/app/services/__init__.py
"""Services module for CodeGuard AI."""

from app.services.github import GitHubService
from app.services.queue import QueueService, RateLimiter, get_redis_client

__all__ = [
    "GitHubService",
    "QueueService",
    "RateLimiter",
    "get_redis_client",
]
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_github_service.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/services/ backend/tests/test_github_service.py
git commit -m "feat: add GitHub service client for PR operations

- get_pr_diff, get_pr_files, get_pr_info
- post_comment, update_comment, delete_comment
- Uses httpx with proper headers and timeouts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Webhook Signature Verification

**Files:**
- Create: `backend/app/api/webhooks.py`
- Create: `backend/tests/test_webhooks.py`

**Step 1: Write failing test for signature verification**

```python
# backend/tests/test_webhooks.py
"""Tests for GitHub webhook handling."""

import hashlib
import hmac
import json
import pytest
from unittest.mock import MagicMock, patch

from app.api.webhooks import verify_signature, WebhookPayload


class TestSignatureVerification:
    """Tests for webhook signature verification."""

    def test_verify_valid_signature(self):
        """Test that valid signature passes verification."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'

        # Generate valid signature
        signature = "sha256=" + hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        result = verify_signature(payload, signature, secret)
        assert result is True

    def test_verify_invalid_signature(self):
        """Test that invalid signature fails verification."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'
        signature = "sha256=invalid"

        result = verify_signature(payload, signature, secret)
        assert result is False

    def test_verify_missing_prefix(self):
        """Test that signature without sha256= prefix fails."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'
        signature = "notavalidformat"

        result = verify_signature(payload, signature, secret)
        assert result is False


class TestWebhookPayload:
    """Tests for webhook payload parsing."""

    def test_parse_pr_opened_payload(self):
        """Test parsing pull_request.opened event."""
        data = {
            "action": "opened",
            "number": 42,
            "pull_request": {
                "title": "Add new feature",
                "head": {"sha": "abc123"},
            },
            "repository": {
                "id": 123456,
                "full_name": "owner/repo",
            },
        }

        payload = WebhookPayload(**data)

        assert payload.action == "opened"
        assert payload.number == 42
        assert payload.repository.full_name == "owner/repo"

    def test_parse_pr_synchronize_payload(self):
        """Test parsing pull_request.synchronize event."""
        data = {
            "action": "synchronize",
            "number": 42,
            "pull_request": {
                "title": "Add new feature",
                "head": {"sha": "def456"},
            },
            "repository": {
                "id": 123456,
                "full_name": "owner/repo",
            },
        }

        payload = WebhookPayload(**data)

        assert payload.action == "synchronize"
        assert payload.pull_request.head.sha == "def456"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_webhooks.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.api.webhooks'"

**Step 3: Create webhook module with signature verification and payload models**

```python
# backend/app/api/webhooks.py
"""GitHub webhook handling."""

import hashlib
import hmac
from typing import Optional

from pydantic import BaseModel


class GitHubUser(BaseModel):
    """GitHub user in webhook payload."""
    login: str
    id: int


class GitHubHead(BaseModel):
    """PR head reference."""
    sha: str
    ref: Optional[str] = None


class GitHubBase(BaseModel):
    """PR base reference."""
    sha: str
    ref: Optional[str] = None


class GitHubPullRequest(BaseModel):
    """Pull request data in webhook payload."""
    title: str
    head: GitHubHead
    base: Optional[GitHubBase] = None
    body: Optional[str] = None
    user: Optional[GitHubUser] = None


class GitHubRepository(BaseModel):
    """Repository data in webhook payload."""
    id: int
    full_name: str
    name: Optional[str] = None
    private: Optional[bool] = None


class WebhookPayload(BaseModel):
    """GitHub webhook payload for pull_request events."""
    action: str
    number: int
    pull_request: GitHubPullRequest
    repository: GitHubRepository
    sender: Optional[GitHubUser] = None


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature.

    Args:
        payload: Raw request body bytes
        signature: X-Hub-Signature-256 header value
        secret: Webhook secret configured in GitHub

    Returns:
        True if signature is valid, False otherwise
    """
    if not signature.startswith("sha256="):
        return False

    expected_signature = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_webhooks.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/api/webhooks.py backend/tests/test_webhooks.py
git commit -m "feat: add webhook signature verification and payload models

- verify_signature() with HMAC-SHA256
- Pydantic models for webhook payload parsing
- Tests for valid/invalid signatures

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Webhook Endpoint

**Files:**
- Modify: `backend/app/api/webhooks.py`
- Modify: `backend/tests/test_webhooks.py`
- Modify: `backend/app/main.py`

**Step 1: Add test for webhook endpoint**

Add to `backend/tests/test_webhooks.py`:

```python
# Add these imports at the top
from fastapi.testclient import TestClient
from app.main import app


class TestWebhookEndpoint:
    """Tests for webhook endpoint."""

    def setup_method(self):
        """Set up test client."""
        self.client = TestClient(app)

    @patch("app.api.webhooks.settings")
    @patch("app.api.webhooks.get_repository_repo")
    @patch("app.api.webhooks.get_review_repo")
    @patch("app.api.webhooks.get_queue_service")
    def test_webhook_pr_opened(
        self,
        mock_queue,
        mock_review_repo,
        mock_repo_repo,
        mock_settings,
    ):
        """Test handling pull_request.opened event."""
        # Setup mocks
        mock_settings.github_webhook_secret = "test-secret"

        mock_repo = MagicMock()
        mock_repo.id = "repo-uuid"
        mock_repo_repo.return_value.get_by_github_id.return_value = mock_repo

        mock_review = MagicMock()
        mock_review.id = "review-uuid"
        mock_review_repo.return_value.create.return_value = mock_review

        mock_queue.return_value.enqueue_review = MagicMock()

        # Create payload
        payload = {
            "action": "opened",
            "number": 42,
            "pull_request": {
                "title": "Test PR",
                "head": {"sha": "abc123"},
            },
            "repository": {
                "id": 123456,
                "full_name": "owner/repo",
            },
        }
        payload_bytes = json.dumps(payload).encode()

        # Generate valid signature
        signature = "sha256=" + hmac.new(
            b"test-secret",
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()

        # Make request
        response = self.client.post(
            "/api/webhook/github",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": signature,
            },
        )

        assert response.status_code == 200
        assert response.json()["status"] == "queued"

    def test_webhook_invalid_signature(self):
        """Test that invalid signature returns 401."""
        payload = b'{"action": "opened"}'

        response = self.client.post(
            "/api/webhook/github",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": "sha256=invalid",
            },
        )

        assert response.status_code == 401

    def test_webhook_ignored_event(self):
        """Test that non-PR events are ignored."""
        payload = b'{"action": "created"}'

        response = self.client.post(
            "/api/webhook/github",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "issues",  # Not pull_request
                "X-Hub-Signature-256": "sha256=whatever",
            },
        )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_webhooks.py::TestWebhookEndpoint -v`
Expected: FAIL (endpoint doesn't exist yet)

**Step 3: Add webhook endpoint to webhooks.py**

Update `backend/app/api/webhooks.py` to add the endpoint:

```python
# backend/app/api/webhooks.py
"""GitHub webhook handling."""

import hashlib
import hmac
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.db import RepositoryRepo, ReviewRepo
from app.db.database import get_db
from app.models import RepositoryCreate, ReviewCreate
from app.services.queue import QueueService, get_redis_client
from supabase import Client


router = APIRouter(prefix="/api/webhook", tags=["webhooks"])


# Pydantic models for webhook payload
class GitHubUser(BaseModel):
    """GitHub user in webhook payload."""
    login: str
    id: int


class GitHubHead(BaseModel):
    """PR head reference."""
    sha: str
    ref: Optional[str] = None


class GitHubBase(BaseModel):
    """PR base reference."""
    sha: str
    ref: Optional[str] = None


class GitHubPullRequest(BaseModel):
    """Pull request data in webhook payload."""
    title: str
    head: GitHubHead
    base: Optional[GitHubBase] = None
    body: Optional[str] = None
    user: Optional[GitHubUser] = None


class GitHubRepository(BaseModel):
    """Repository data in webhook payload."""
    id: int
    full_name: str
    name: Optional[str] = None
    private: Optional[bool] = None


class WebhookPayload(BaseModel):
    """GitHub webhook payload for pull_request events."""
    action: str
    number: int
    pull_request: GitHubPullRequest
    repository: GitHubRepository
    sender: Optional[GitHubUser] = None


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature.

    Args:
        payload: Raw request body bytes
        signature: X-Hub-Signature-256 header value
        secret: Webhook secret configured in GitHub

    Returns:
        True if signature is valid, False otherwise
    """
    if not signature.startswith("sha256="):
        return False

    expected_signature = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


# Dependency injection helpers
def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


def get_queue_service() -> QueueService:
    """Get QueueService instance."""
    return QueueService(get_redis_client())


@router.post("/github")
async def handle_github_webhook(
    request: Request,
    x_github_event: Annotated[str, Header()],
    x_hub_signature_256: Annotated[str, Header()],
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)],
    queue: Annotated[QueueService, Depends(get_queue_service)],
):
    """Handle incoming GitHub webhook events.

    Processes pull_request.opened and pull_request.synchronize events
    by creating review records and enqueueing review jobs.
    """
    # Get raw body for signature verification
    body = await request.body()

    # Ignore non-PR events early (before signature check for efficiency)
    if x_github_event != "pull_request":
        return {"status": "ignored", "reason": f"event type: {x_github_event}"}

    # Verify webhook signature
    if not verify_signature(body, x_hub_signature_256, settings.github_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    payload = WebhookPayload.model_validate_json(body)

    # Only process opened and synchronize actions
    if payload.action not in ("opened", "synchronize"):
        return {"status": "ignored", "reason": f"action: {payload.action}"}

    # Get or create repository record
    repo = repo_repo.get_by_github_id(payload.repository.id)
    if not repo:
        repo = repo_repo.create(
            RepositoryCreate(
                github_id=payload.repository.id,
                full_name=payload.repository.full_name,
            )
        )

    # Create review record
    review = review_repo.create(
        ReviewCreate(
            repository_id=repo.id,
            pr_number=payload.number,
            pr_title=payload.pull_request.title,
            commit_sha=payload.pull_request.head.sha,
        )
    )

    # Enqueue review job
    job_id = str(uuid4())
    queue.enqueue_review(
        job_id=job_id,
        data={
            "review_id": str(review.id),
            "owner": payload.repository.full_name.split("/")[0],
            "repo": payload.repository.full_name.split("/")[1],
            "pr_number": payload.number,
            "commit_sha": payload.pull_request.head.sha,
        },
    )

    return {
        "status": "queued",
        "review_id": str(review.id),
        "job_id": job_id,
    }
```

**Step 4: Register router in main.py**

Update `backend/app/main.py` to include the webhook router. Add after the imports:

```python
from app.api.webhooks import router as webhook_router
```

And after the CORS middleware setup, add:

```python
# Include routers
app.include_router(webhook_router)
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_webhooks.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/api/webhooks.py backend/app/main.py backend/tests/test_webhooks.py
git commit -m "feat: add webhook endpoint for GitHub PR events

- POST /api/webhook/github endpoint
- Signature verification before processing
- Creates repository and review records
- Enqueues review job for async processing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add GitHub Token Authentication Support

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/services/github.py`
- Modify: `backend/tests/test_github_service.py`

**Step 1: Add GitHub token to config**

Update `backend/app/config.py` to add a GitHub personal access token option:

```python
# In the Settings class, add after github_webhook_secret:
    github_token: str = ""  # Personal access token for API calls
```

**Step 2: Update GitHub service to use token from settings**

Update the `__init__` method in `backend/app/services/github.py`:

```python
def __init__(self, token: Optional[str] = None):
    """Initialize GitHub client with authentication token."""
    self.token = token or settings.github_token or settings.github_private_key
    if not self.token:
        raise ValueError("GitHub token is required")
    self.headers = {
        "Authorization": f"Bearer {self.token}",
        "Accept": self.ACCEPT_JSON,
        "X-GitHub-Api-Version": "2022-11-28",
    }
```

**Step 3: Add test for missing token**

Add to `backend/tests/test_github_service.py`:

```python
@patch("app.services.github.settings")
def test_init_without_token_raises(self, mock_settings):
    """Test that missing token raises ValueError."""
    mock_settings.github_token = ""
    mock_settings.github_private_key = ""

    with pytest.raises(ValueError, match="GitHub token is required"):
        GitHubService()
```

**Step 4: Update .env.example**

Add to `backend/.env.example`:

```bash
# GitHub Personal Access Token (for API calls)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_github_service.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/config.py backend/app/services/github.py backend/tests/test_github_service.py backend/.env.example
git commit -m "feat: add GitHub token configuration

- github_token setting in config
- Fallback chain: explicit token > settings.github_token > settings.github_private_key
- Raises ValueError if no token available

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Dependency Injection for GitHub Service

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add GitHub service dependency**

Add to `backend/app/main.py` after the existing imports:

```python
from app.services.github import GitHubService
```

Add the dependency function after the existing ones:

```python
def get_github_service() -> GitHubService:
    """Get GitHubService instance."""
    return GitHubService()
```

**Step 2: Run all tests to verify nothing broke**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add GitHub service dependency injection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create API Router Structure

**Files:**
- Create: `backend/app/api/__init__.py` (update from empty)
- Modify: `backend/app/main.py`

**Step 1: Update api __init__.py with router exports**

```python
# backend/app/api/__init__.py
"""API routers for CodeGuard AI."""

from app.api.webhooks import router as webhook_router

__all__ = ["webhook_router"]
```

**Step 2: Update main.py to use cleaner imports**

Update the import in `backend/app/main.py`:

```python
# Replace: from app.api.webhooks import router as webhook_router
# With:
from app.api import webhook_router
```

**Step 3: Run all tests**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add backend/app/api/__init__.py backend/app/main.py
git commit -m "refactor: organize API router exports

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Verify Full Integration

**Step 1: Run all tests**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS (should be 40+ tests now)

**Step 2: Test server startup**

Run: `cd backend && python -c "from app.main import app; print('App loaded successfully')"`
Expected: "App loaded successfully"

**Step 3: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: address any integration issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

After completing this plan, you will have:

1. **GitHub Service Client** (`app/services/github.py`)
   - `get_pr_diff()` - Fetch PR diff in unified format
   - `get_pr_files()` - List changed files with patches
   - `get_pr_info()` - Fetch PR metadata
   - `post_comment()` - Post review comment
   - `update_comment()` - Update existing comment
   - `delete_comment()` - Delete comment

2. **Webhook Handling** (`app/api/webhooks.py`)
   - `verify_signature()` - HMAC-SHA256 verification
   - Pydantic models for webhook payloads
   - `POST /api/webhook/github` endpoint

3. **Integration**
   - Webhook creates repository and review records
   - Enqueues review job for async processing
   - Ready for Phase 3 (AI agents) to consume jobs

**Next Phase:** Phase 3 - LLM & Agents (Gemini client, Logic/Security/Quality agents, LangGraph supervisor)
