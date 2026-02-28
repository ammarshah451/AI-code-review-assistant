"""Review model for PR review records."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ReviewStatus(str, Enum):
    """Review status enum."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ReviewBase(BaseModel):
    """Base review schema."""
    pr_number: int
    pr_title: Optional[str] = None
    commit_sha: Optional[str] = None
    diff_content: Optional[str] = None


class ReviewCreate(ReviewBase):
    """Schema for creating a review."""
    repository_id: UUID


class Review(ReviewBase):
    """Review schema with database fields."""
    id: UUID
    repository_id: UUID
    status: ReviewStatus = ReviewStatus.PENDING
    comment_id: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
