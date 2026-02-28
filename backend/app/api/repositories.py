# backend/app/api/repositories.py
"""Repositories API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.db import RepositoryRepo, SettingsRepo
from app.db.database import get_db
from app.models import (
    PaginatedResponse,
    Repository,
    RepositoryCreate,
    Settings,
    SettingsUpdate,
)


# Router
router = APIRouter(prefix="/api", tags=["repositories"])


# Dependency injection
def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


def get_settings_repo(db: Annotated[Client, Depends(get_db)]) -> SettingsRepo:
    """Get SettingsRepo instance."""
    return SettingsRepo(db)


@router.get("/repositories", response_model=PaginatedResponse[Repository])
def list_repositories(
    repository_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[Repository]:
    """List all repositories with pagination."""
    offset = (page - 1) * per_page
    repositories, total = repository_repo.get_all_paginated(offset=offset, limit=per_page)

    # Calculate total pages
    pages = (total + per_page - 1) // per_page if total > 0 else 0

    return PaginatedResponse(
        items=repositories,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.post("/repositories", response_model=Repository, status_code=status.HTTP_201_CREATED)
def create_repository(
    repository_data: RepositoryCreate,
    repository_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
) -> Repository:
    """Create a new repository."""
    # Check if repository with this github_id already exists
    existing = repository_repo.get_by_github_id(repository_data.github_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository with this GitHub ID already exists",
        )

    return repository_repo.create(repository_data)


@router.get("/repositories/{repo_id}", response_model=Repository)
def get_repository(
    repo_id: UUID,
    repository_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
) -> Repository:
    """Get a repository by ID."""
    repository = repository_repo.get_by_id(repo_id)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repository


@router.delete("/repositories/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repository(
    repo_id: UUID,
    repository_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)],
) -> None:
    """Delete a repository."""
    repository_repo.delete(repo_id)
    return None


@router.get("/repositories/{repo_id}/settings", response_model=Settings)
def get_repository_settings(
    repo_id: UUID,
    settings_repo: Annotated[SettingsRepo, Depends(get_settings_repo)],
) -> Settings:
    """Get settings for a repository, creating defaults if not exists."""
    return settings_repo.get_or_create(repo_id)


@router.put("/repositories/{repo_id}/settings", response_model=Settings)
def update_repository_settings(
    repo_id: UUID,
    settings_data: SettingsUpdate,
    settings_repo: Annotated[SettingsRepo, Depends(get_settings_repo)],
) -> Settings:
    """Update settings for a repository."""
    settings = settings_repo.update(repo_id, settings_data)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings
