"""Pagination models for API responses."""

from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Parameters for paginated requests."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    per_page: int = Field(
        default=20, ge=1, le=100, description="Items per page (1-100)"
    )

    @field_validator("page")
    @classmethod
    def validate_page(cls, v: int) -> int:
        """Ensure page is at least 1."""
        if v < 1:
            raise ValueError("page must be at least 1")
        return v

    @field_validator("per_page")
    @classmethod
    def validate_per_page(cls, v: int) -> int:
        """Ensure per_page is between 1 and 100."""
        if v < 1:
            raise ValueError("per_page must be at least 1")
        if v > 100:
            raise ValueError("per_page must be at most 100")
        return v

    @property
    def offset(self) -> int:
        """Calculate the offset for database queries."""
        return (self.page - 1) * self.per_page


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: List[T]
    total: int = Field(ge=0, description="Total number of items")
    page: int = Field(ge=1, description="Current page number")
    per_page: int = Field(ge=1, description="Items per page")
    pages: int = Field(ge=0, description="Total number of pages")

    @property
    def has_next(self) -> bool:
        """Check if there is a next page."""
        return self.page < self.pages

    @property
    def has_prev(self) -> bool:
        """Check if there is a previous page."""
        return self.page > 1

    class Config:
        """Pydantic configuration."""

        from_attributes = True
