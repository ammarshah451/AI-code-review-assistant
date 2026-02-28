# backend/app/api/webhooks.py
"""GitHub webhook handling."""

import hashlib
import hmac
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from supabase import Client

from app.config import settings
from app.db import RepositoryRepo, ReviewRepo
from app.db.database import get_db
from app.models import RepositoryCreate, ReviewCreate
from app.worker import process_review

# Router
router = APIRouter(prefix="/api/webhook", tags=["webhooks"])


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


# Dependency injection
def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


# Webhook endpoint
@router.post("/github")
async def handle_github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: Annotated[str, Header()],
    x_hub_signature_256: Annotated[Optional[str], Header()] = None,
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)] = None,
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)] = None,
):
    """Handle incoming GitHub webhook events.

    Validates the webhook signature, creates a review record, and adds
    a background task to process the review.
    """
    body = await request.body()

    # Ignore non-PR events
    if x_github_event != "pull_request":
        return {"status": "ignored", "reason": f"event type: {x_github_event}"}

    # Verify signature (skip if no secret configured or no signature provided)
    if settings.github_webhook_secret and x_hub_signature_256:
        if not verify_signature(body, x_hub_signature_256, settings.github_webhook_secret):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    payload = WebhookPayload.model_validate_json(body)

    # Only process opened and synchronize
    if payload.action not in ("opened", "synchronize"):
        return {"status": "ignored", "reason": f"action: {payload.action}"}

    # Get or create repository
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

    # Prepare job data
    job_data = {
        "review_id": str(review.id),
        "owner": payload.repository.full_name.split("/")[0],
        "repo": payload.repository.full_name.split("/")[1],
        "pr_number": payload.number,
        "commit_sha": payload.pull_request.head.sha,
    }

    # Process review in the background via FastAPI BackgroundTasks
    background_tasks.add_task(process_review, job_data)

    return {
        "status": "processing",
        "review_id": str(review.id),
    }

