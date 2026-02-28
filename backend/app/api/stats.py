# backend/app/api/stats.py
"""Stats API endpoints for dashboard."""

from typing import Annotated, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.db import RepositoryRepo, ReviewRepo
from app.db.database import get_db


# Router
router = APIRouter(prefix="/api/stats", tags=["stats"])


class DashboardStats(BaseModel):
    """Dashboard statistics model."""

    total_repositories: int
    total_reviews: int
    reviews_by_status: Dict[str, int]


# Dependency injection
def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


@router.get("", response_model=DashboardStats)
def get_dashboard_stats(
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)],
) -> DashboardStats:
    """Get dashboard statistics."""
    return DashboardStats(
        total_repositories=repo_repo.count_all(),
        total_reviews=review_repo.count_all(),
        reviews_by_status=review_repo.count_by_status(),
    )
