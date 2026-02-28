"""Repository model for connected GitHub repositories."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RepositoryBase(BaseModel):
    """Base repository schema."""
    github_id: int
    full_name: str  # owner/repo format


class RepositoryCreate(RepositoryBase):
    """Schema for creating a repository."""
    webhook_secret: Optional[str] = None


class Repository(RepositoryBase):
    """Repository schema with database fields."""
    id: UUID
    webhook_secret: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
