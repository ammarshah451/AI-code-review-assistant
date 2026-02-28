# backend/app/api/reviews.py
"""Reviews API endpoints."""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from app.db import FindingRepo, ReviewRepo
from app.db.database import get_db
from app.models import Finding, PaginatedResponse, Review


# Router
router = APIRouter(prefix="/api", tags=["reviews"])


# Response model for review with findings
class ReviewWithFindings(Review):
    """Review with associated findings."""

    findings: List[Finding] = []


# Dependency injection
def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


def get_finding_repo(db: Annotated[Client, Depends(get_db)]) -> FindingRepo:
    """Get FindingRepo instance."""
    return FindingRepo(db)


@router.get("/reviews", response_model=PaginatedResponse[Review])
def list_reviews(
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)],
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[Review]:
    """List all reviews with pagination."""
    offset = (page - 1) * per_page
    reviews, total = review_repo.get_all_paginated(offset=offset, limit=per_page)

    # Calculate total pages
    pages = (total + per_page - 1) // per_page if total > 0 else 0

    return PaginatedResponse(
        items=reviews,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/reviews/{review_id}", response_model=ReviewWithFindings)
def get_review(
    review_id: UUID,
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)],
    finding_repo: Annotated[FindingRepo, Depends(get_finding_repo)],
) -> ReviewWithFindings:
    """Get a review by ID with its findings."""
    review = review_repo.get_by_id(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    findings = finding_repo.get_by_review(review_id)

    return ReviewWithFindings(
        id=review.id,
        repository_id=review.repository_id,
        pr_number=review.pr_number,
        pr_title=review.pr_title,
        commit_sha=review.commit_sha,
        status=review.status,
        comment_id=review.comment_id,
        created_at=review.created_at,
        completed_at=review.completed_at,
        findings=findings,
    )


@router.get("/repositories/{repo_id}/reviews", response_model=List[Review])
def get_reviews_by_repository(
    repo_id: UUID,
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)],
    limit: int = Query(default=50, ge=1, le=100, description="Maximum reviews to return"),
) -> List[Review]:
    """Get reviews for a specific repository."""
    return review_repo.get_by_repository(repo_id, limit=limit)


class FalsePositiveRequest(BaseModel):
    """Request body for marking false positive."""

    is_false_positive: bool
    reason: Optional[str] = None


@router.put("/findings/{finding_id}/false-positive", response_model=Finding)
def mark_false_positive(
    finding_id: UUID,
    request: FalsePositiveRequest,
    finding_repo: Annotated[FindingRepo, Depends(get_finding_repo)],
) -> Finding:
    """Mark a finding as false positive."""
    finding = finding_repo.mark_false_positive(
        finding_id,
        request.is_false_positive,
        request.reason,
    )

    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    return finding
