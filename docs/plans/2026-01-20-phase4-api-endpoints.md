# Phase 4: API Endpoints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build REST API endpoints for review history, repository management, and settings configuration to power the frontend dashboard.

**Architecture:** Create two new API routers (reviews, repositories) following the existing webhook router pattern. Each router uses FastAPI dependency injection for database access. Responses use existing Pydantic models with new response wrappers for pagination.

**Tech Stack:** FastAPI, Pydantic, Supabase (via existing repos)

---

## Prerequisites

- Phase 1-3 complete (107 tests passing)
- Existing database repositories: `RepositoryRepo`, `ReviewRepo`, `FindingRepo`, `SettingsRepo`
- Existing Pydantic models for all entities

---

## Task 1: Create Pagination Models

**Files:**
- Create: `backend/app/models/pagination.py`
- Create: `backend/tests/test_pagination_models.py`
- Modify: `backend/app/models/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_pagination_models.py
"""Tests for pagination models."""

import pytest

from app.models.pagination import PaginatedResponse, PaginationParams


class TestPaginationParams:
    """Tests for PaginationParams."""

    def test_default_values(self):
        """Test default pagination values."""
        params = PaginationParams()
        assert params.page == 1
        assert params.per_page == 20

    def test_custom_values(self):
        """Test custom pagination values."""
        params = PaginationParams(page=3, per_page=50)
        assert params.page == 3
        assert params.per_page == 50

    def test_offset_calculation(self):
        """Test offset is calculated correctly."""
        params = PaginationParams(page=3, per_page=20)
        assert params.offset == 40  # (3-1) * 20

    def test_page_minimum_is_one(self):
        """Test page cannot be less than 1."""
        params = PaginationParams(page=0, per_page=20)
        assert params.page >= 1

    def test_per_page_maximum(self):
        """Test per_page cannot exceed 100."""
        params = PaginationParams(page=1, per_page=200)
        assert params.per_page <= 100


class TestPaginatedResponse:
    """Tests for PaginatedResponse."""

    def test_create_paginated_response(self):
        """Test creating a paginated response."""
        response = PaginatedResponse(
            items=["a", "b", "c"],
            total=100,
            page=1,
            per_page=20,
            pages=5,
        )
        assert response.items == ["a", "b", "c"]
        assert response.total == 100
        assert response.page == 1
        assert response.pages == 5

    def test_has_next_and_prev(self):
        """Test has_next and has_prev properties."""
        response = PaginatedResponse(
            items=[],
            total=100,
            page=2,
            per_page=20,
            pages=5,
        )
        assert response.has_next is True
        assert response.has_prev is True

    def test_first_page_no_prev(self):
        """Test first page has no previous."""
        response = PaginatedResponse(
            items=[],
            total=100,
            page=1,
            per_page=20,
            pages=5,
        )
        assert response.has_prev is False
        assert response.has_next is True

    def test_last_page_no_next(self):
        """Test last page has no next."""
        response = PaginatedResponse(
            items=[],
            total=100,
            page=5,
            per_page=20,
            pages=5,
        )
        assert response.has_next is False
        assert response.has_prev is True
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_pagination_models.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.pagination'`

### Step 3: Write minimal implementation

```python
# backend/app/models/pagination.py
"""Pagination models for API responses."""

from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Query parameters for pagination."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    per_page: int = Field(default=20, ge=1, le=100, description="Items per page")

    @field_validator("page", mode="before")
    @classmethod
    def validate_page(cls, v):
        """Ensure page is at least 1."""
        return max(1, int(v)) if v else 1

    @field_validator("per_page", mode="before")
    @classmethod
    def validate_per_page(cls, v):
        """Ensure per_page is between 1 and 100."""
        v = int(v) if v else 20
        return min(100, max(1, v))

    @property
    def offset(self) -> int:
        """Calculate offset for database query."""
        return (self.page - 1) * self.per_page


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: List[T]
    total: int = Field(description="Total number of items")
    page: int = Field(description="Current page number")
    per_page: int = Field(description="Items per page")
    pages: int = Field(description="Total number of pages")

    @property
    def has_next(self) -> bool:
        """Check if there is a next page."""
        return self.page < self.pages

    @property
    def has_prev(self) -> bool:
        """Check if there is a previous page."""
        return self.page > 1

    model_config = {"from_attributes": True}
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_pagination_models.py -v`

Expected: 8 passed

### Step 5: Update models __init__.py

Add to `backend/app/models/__init__.py`:
```python
from app.models.pagination import PaginatedResponse, PaginationParams
```

And add to `__all__`:
```python
    "PaginatedResponse",
    "PaginationParams",
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 115 passed

### Step 7: Commit

```bash
git add backend/app/models/pagination.py backend/tests/test_pagination_models.py backend/app/models/__init__.py
git commit -m "feat: add pagination models for API responses"
```

---

## Task 2: Add Repository Methods for Pagination

**Files:**
- Modify: `backend/app/db/repositories.py`
- Modify: `backend/tests/test_db_repositories.py`

### Step 1: Write the failing tests

Add to `backend/tests/test_db_repositories.py`:

```python
class TestReviewRepoPagination:
    """Tests for ReviewRepo pagination methods."""

    def test_get_all_paginated(self, mock_supabase_client):
        """Test getting paginated reviews."""
        mock_supabase_client.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "repository_id": "123e4567-e89b-12d3-a456-426614174001",
                "pr_number": 1,
                "pr_title": "Test PR",
                "commit_sha": "abc123",
                "status": "completed",
                "comment_id": None,
                "created_at": "2024-01-01T00:00:00Z",
                "completed_at": None,
            }
        ]
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.count = 50

        repo = ReviewRepo(mock_supabase_client)
        reviews, total = repo.get_all_paginated(offset=0, limit=20)

        assert len(reviews) == 1
        assert total == 50

    def test_count_all(self, mock_supabase_client):
        """Test counting all reviews."""
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.count = 42

        repo = ReviewRepo(mock_supabase_client)
        count = repo.count_all()

        assert count == 42


class TestRepositoryRepoPagination:
    """Tests for RepositoryRepo pagination methods."""

    def test_get_all_paginated(self, mock_supabase_client):
        """Test getting paginated repositories."""
        mock_supabase_client.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "github_id": 12345,
                "full_name": "owner/repo",
                "webhook_secret": None,
                "created_at": "2024-01-01T00:00:00Z",
            }
        ]
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.count = 10

        repo = RepositoryRepo(mock_supabase_client)
        repos, total = repo.get_all_paginated(offset=0, limit=20)

        assert len(repos) == 1
        assert total == 10

    def test_count_all(self, mock_supabase_client):
        """Test counting all repositories."""
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.count = 5

        repo = RepositoryRepo(mock_supabase_client)
        count = repo.count_all()

        assert count == 5
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_db_repositories.py::TestReviewRepoPagination -v`

Expected: FAIL with `AttributeError: 'ReviewRepo' object has no attribute 'get_all_paginated'`

### Step 3: Add pagination methods to ReviewRepo

Add to `ReviewRepo` class in `backend/app/db/repositories.py`:

```python
    def get_all_paginated(
        self, offset: int = 0, limit: int = 20
    ) -> tuple[List[Review], int]:
        """Get paginated reviews with total count."""
        # Get paginated data
        result = (
            self.client.table(self.table)
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        reviews = [Review(**row) for row in result.data]

        # Get total count
        count_result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        total = count_result.count or 0

        return reviews, total

    def count_all(self) -> int:
        """Count all reviews."""
        result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        return result.count or 0
```

### Step 4: Add pagination methods to RepositoryRepo

Add to `RepositoryRepo` class in `backend/app/db/repositories.py`:

```python
    def get_all_paginated(
        self, offset: int = 0, limit: int = 20
    ) -> tuple[List[Repository], int]:
        """Get paginated repositories with total count."""
        # Get paginated data
        result = (
            self.client.table(self.table)
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        repos = [Repository(**row) for row in result.data]

        # Get total count
        count_result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        total = count_result.count or 0

        return repos, total

    def count_all(self) -> int:
        """Count all repositories."""
        result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        return result.count or 0
```

### Step 5: Run tests to verify they pass

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_db_repositories.py -v`

Expected: 24 passed (20 existing + 4 new)

### Step 6: Commit

```bash
git add backend/app/db/repositories.py backend/tests/test_db_repositories.py
git commit -m "feat: add pagination methods to repository classes"
```

---

## Task 3: Create Reviews API Router

**Files:**
- Create: `backend/app/api/reviews.py`
- Create: `backend/tests/test_api_reviews.py`
- Modify: `backend/app/api/__init__.py`
- Modify: `backend/app/main.py`

### Step 1: Write the failing tests

```python
# backend/tests/test_api_reviews.py
"""Tests for reviews API endpoints."""

import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.reviews import get_review_repo, get_finding_repo
from app.main import app


class TestReviewsAPI:
    """Tests for reviews API endpoints."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_review_repo = MagicMock()
        self.mock_finding_repo = MagicMock()

        app.dependency_overrides[get_review_repo] = lambda: self.mock_review_repo
        app.dependency_overrides[get_finding_repo] = lambda: self.mock_finding_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_list_reviews(self):
        """Test GET /api/reviews returns paginated list."""
        review_id = uuid4()
        repo_id = uuid4()
        self.mock_review_repo.get_all_paginated.return_value = (
            [
                MagicMock(
                    id=review_id,
                    repository_id=repo_id,
                    pr_number=42,
                    pr_title="Test PR",
                    commit_sha="abc123",
                    status="completed",
                    comment_id=None,
                    created_at="2024-01-01T00:00:00Z",
                    completed_at=None,
                )
            ],
            1,
        )

        response = self.client.get("/api/reviews")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] == 1
        assert data["page"] == 1

    def test_list_reviews_with_pagination(self):
        """Test GET /api/reviews with pagination params."""
        self.mock_review_repo.get_all_paginated.return_value = ([], 0)

        response = self.client.get("/api/reviews?page=2&per_page=10")

        assert response.status_code == 200
        self.mock_review_repo.get_all_paginated.assert_called_once_with(
            offset=10, limit=10
        )

    def test_get_review_by_id(self):
        """Test GET /api/reviews/{id} returns review with findings."""
        review_id = uuid4()
        repo_id = uuid4()
        self.mock_review_repo.get_by_id.return_value = MagicMock(
            id=review_id,
            repository_id=repo_id,
            pr_number=42,
            pr_title="Test PR",
            commit_sha="abc123",
            status="completed",
            comment_id=123,
            created_at="2024-01-01T00:00:00Z",
            completed_at="2024-01-01T00:01:00Z",
        )
        self.mock_finding_repo.get_by_review.return_value = []

        response = self.client.get(f"/api/reviews/{review_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(review_id)
        assert "findings" in data

    def test_get_review_not_found(self):
        """Test GET /api/reviews/{id} returns 404 for unknown review."""
        self.mock_review_repo.get_by_id.return_value = None

        response = self.client.get(f"/api/reviews/{uuid4()}")

        assert response.status_code == 404

    def test_get_reviews_by_repository(self):
        """Test GET /api/repositories/{repo_id}/reviews."""
        repo_id = uuid4()
        self.mock_review_repo.get_by_repository.return_value = []

        response = self.client.get(f"/api/repositories/{repo_id}/reviews")

        assert response.status_code == 200
        assert response.json() == []
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_api_reviews.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.api.reviews'`

### Step 3: Write minimal implementation

```python
# backend/app/api/reviews.py
"""Reviews API endpoints."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.db import FindingRepo, ReviewRepo
from app.db.database import get_db
from app.models import Finding, Review
from app.models.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/api", tags=["reviews"])


# Dependency injection
def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


def get_finding_repo(db: Annotated[Client, Depends(get_db)]) -> FindingRepo:
    """Get FindingRepo instance."""
    return FindingRepo(db)


# Response models
class ReviewWithFindings(Review):
    """Review with its findings."""
    findings: List[Finding] = []


# Endpoints
@router.get("/reviews", response_model=PaginatedResponse[Review])
def list_reviews(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)] = None,
):
    """List all reviews with pagination."""
    params = PaginationParams(page=page, per_page=per_page)
    reviews, total = review_repo.get_all_paginated(
        offset=params.offset, limit=params.per_page
    )

    pages = (total + params.per_page - 1) // params.per_page if total > 0 else 1

    return PaginatedResponse(
        items=reviews,
        total=total,
        page=params.page,
        per_page=params.per_page,
        pages=pages,
    )


@router.get("/reviews/{review_id}", response_model=ReviewWithFindings)
def get_review(
    review_id: UUID,
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)] = None,
    finding_repo: Annotated[FindingRepo, Depends(get_finding_repo)] = None,
):
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
    limit: int = Query(default=50, ge=1, le=100),
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)] = None,
):
    """Get reviews for a specific repository."""
    return review_repo.get_by_repository(repo_id, limit=limit)
```

### Step 4: Update api __init__.py

```python
# backend/app/api/__init__.py
"""API routers for CodeGuard AI."""

from app.api.reviews import router as reviews_router
from app.api.webhooks import router as webhook_router

__all__ = ["webhook_router", "reviews_router"]
```

### Step 5: Update main.py to include router

Add after `app.include_router(webhook_router)`:

```python
from app.api import webhook_router, reviews_router

# Include routers
app.include_router(webhook_router)
app.include_router(reviews_router)
```

### Step 6: Run tests to verify they pass

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_api_reviews.py -v`

Expected: 5 passed

### Step 7: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: ~124 passed

### Step 8: Commit

```bash
git add backend/app/api/reviews.py backend/tests/test_api_reviews.py backend/app/api/__init__.py backend/app/main.py
git commit -m "feat: add reviews API endpoints with pagination"
```

---

## Task 4: Create Repositories API Router

**Files:**
- Create: `backend/app/api/repositories.py`
- Create: `backend/tests/test_api_repositories.py`
- Modify: `backend/app/api/__init__.py`
- Modify: `backend/app/main.py`

### Step 1: Write the failing tests

```python
# backend/tests/test_api_repositories.py
"""Tests for repositories API endpoints."""

import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.repositories import get_repository_repo, get_settings_repo
from app.main import app


class TestRepositoriesAPI:
    """Tests for repositories API endpoints."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repo_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repo_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_list_repositories(self):
        """Test GET /api/repositories returns paginated list."""
        repo_id = uuid4()
        self.mock_repo_repo.get_all_paginated.return_value = (
            [
                MagicMock(
                    id=repo_id,
                    github_id=12345,
                    full_name="owner/repo",
                    webhook_secret=None,
                    created_at="2024-01-01T00:00:00Z",
                )
            ],
            1,
        )

        response = self.client.get("/api/repositories")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] == 1

    def test_create_repository(self):
        """Test POST /api/repositories creates a new repository."""
        repo_id = uuid4()
        self.mock_repo_repo.get_by_github_id.return_value = None
        self.mock_repo_repo.create.return_value = MagicMock(
            id=repo_id,
            github_id=12345,
            full_name="owner/repo",
            webhook_secret=None,
            created_at="2024-01-01T00:00:00Z",
        )

        response = self.client.post(
            "/api/repositories",
            json={"github_id": 12345, "full_name": "owner/repo"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["github_id"] == 12345

    def test_create_repository_already_exists(self):
        """Test POST /api/repositories returns 409 if already exists."""
        self.mock_repo_repo.get_by_github_id.return_value = MagicMock()

        response = self.client.post(
            "/api/repositories",
            json={"github_id": 12345, "full_name": "owner/repo"},
        )

        assert response.status_code == 409

    def test_get_repository(self):
        """Test GET /api/repositories/{id} returns repository."""
        repo_id = uuid4()
        self.mock_repo_repo.get_by_id.return_value = MagicMock(
            id=repo_id,
            github_id=12345,
            full_name="owner/repo",
            webhook_secret=None,
            created_at="2024-01-01T00:00:00Z",
        )

        response = self.client.get(f"/api/repositories/{repo_id}")

        assert response.status_code == 200

    def test_get_repository_not_found(self):
        """Test GET /api/repositories/{id} returns 404."""
        self.mock_repo_repo.get_by_id.return_value = None

        response = self.client.get(f"/api/repositories/{uuid4()}")

        assert response.status_code == 404

    def test_delete_repository(self):
        """Test DELETE /api/repositories/{id}."""
        repo_id = uuid4()
        self.mock_repo_repo.delete.return_value = True

        response = self.client.delete(f"/api/repositories/{repo_id}")

        assert response.status_code == 204

    def test_get_repository_settings(self):
        """Test GET /api/repositories/{id}/settings."""
        repo_id = uuid4()
        settings_id = uuid4()
        self.mock_settings_repo.get_or_create.return_value = MagicMock(
            id=settings_id,
            repository_id=repo_id,
            enabled=True,
            agents_enabled={"logic": True, "security": True, "quality": True},
            severity_threshold="info",
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:00:00Z",
        )

        response = self.client.get(f"/api/repositories/{repo_id}/settings")

        assert response.status_code == 200

    def test_update_repository_settings(self):
        """Test PUT /api/repositories/{id}/settings."""
        repo_id = uuid4()
        settings_id = uuid4()
        self.mock_settings_repo.update.return_value = MagicMock(
            id=settings_id,
            repository_id=repo_id,
            enabled=False,
            agents_enabled={"logic": True, "security": False, "quality": True},
            severity_threshold="warning",
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:01:00Z",
        )

        response = self.client.put(
            f"/api/repositories/{repo_id}/settings",
            json={"enabled": False, "severity_threshold": "warning"},
        )

        assert response.status_code == 200

    def test_update_settings_not_found(self):
        """Test PUT /api/repositories/{id}/settings returns 404."""
        self.mock_settings_repo.update.return_value = None

        response = self.client.put(
            f"/api/repositories/{uuid4()}/settings",
            json={"enabled": False},
        )

        assert response.status_code == 404
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_api_repositories.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.api.repositories'`

### Step 3: Write minimal implementation

```python
# backend/app/api/repositories.py
"""Repositories API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from supabase import Client

from app.db import RepositoryRepo, SettingsRepo
from app.db.database import get_db
from app.models import Repository, RepositoryCreate, Settings, SettingsUpdate
from app.models.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/api/repositories", tags=["repositories"])


# Dependency injection
def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


def get_settings_repo(db: Annotated[Client, Depends(get_db)]) -> SettingsRepo:
    """Get SettingsRepo instance."""
    return SettingsRepo(db)


# Endpoints
@router.get("", response_model=PaginatedResponse[Repository])
def list_repositories(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)] = None,
):
    """List all repositories with pagination."""
    params = PaginationParams(page=page, per_page=per_page)
    repos, total = repo_repo.get_all_paginated(
        offset=params.offset, limit=params.per_page
    )

    pages = (total + params.per_page - 1) // params.per_page if total > 0 else 1

    return PaginatedResponse(
        items=repos,
        total=total,
        page=params.page,
        per_page=params.per_page,
        pages=pages,
    )


@router.post("", response_model=Repository, status_code=status.HTTP_201_CREATED)
def create_repository(
    data: RepositoryCreate,
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)] = None,
):
    """Create a new repository."""
    # Check if already exists
    existing = repo_repo.get_by_github_id(data.github_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository already connected",
        )

    return repo_repo.create(data)


@router.get("/{repo_id}", response_model=Repository)
def get_repository(
    repo_id: UUID,
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)] = None,
):
    """Get a repository by ID."""
    repo = repo_repo.get_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repository(
    repo_id: UUID,
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)] = None,
):
    """Delete a repository."""
    repo_repo.delete(repo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{repo_id}/settings", response_model=Settings)
def get_repository_settings(
    repo_id: UUID,
    settings_repo: Annotated[SettingsRepo, Depends(get_settings_repo)] = None,
):
    """Get settings for a repository."""
    return settings_repo.get_or_create(repo_id)


@router.put("/{repo_id}/settings", response_model=Settings)
def update_repository_settings(
    repo_id: UUID,
    data: SettingsUpdate,
    settings_repo: Annotated[SettingsRepo, Depends(get_settings_repo)] = None,
):
    """Update settings for a repository."""
    settings = settings_repo.update(repo_id, data)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings
```

### Step 4: Update api __init__.py

```python
# backend/app/api/__init__.py
"""API routers for CodeGuard AI."""

from app.api.repositories import router as repositories_router
from app.api.reviews import router as reviews_router
from app.api.webhooks import router as webhook_router

__all__ = ["webhook_router", "reviews_router", "repositories_router"]
```

### Step 5: Update main.py to include router

```python
from app.api import webhook_router, reviews_router, repositories_router

# Include routers
app.include_router(webhook_router)
app.include_router(reviews_router)
app.include_router(repositories_router)
```

### Step 6: Run tests to verify they pass

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_api_repositories.py -v`

Expected: 10 passed

### Step 7: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: ~134 passed

### Step 8: Commit

```bash
git add backend/app/api/repositories.py backend/tests/test_api_repositories.py backend/app/api/__init__.py backend/app/main.py
git commit -m "feat: add repositories API with settings endpoints"
```

---

## Task 5: Create Dashboard Stats Endpoint

**Files:**
- Create: `backend/app/api/stats.py`
- Create: `backend/tests/test_api_stats.py`
- Modify: `backend/app/api/__init__.py`
- Modify: `backend/app/main.py`

### Step 1: Write the failing tests

```python
# backend/tests/test_api_stats.py
"""Tests for stats API endpoints."""

import pytest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.api.stats import get_review_repo, get_repository_repo
from app.main import app


class TestStatsAPI:
    """Tests for stats API endpoints."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_review_repo = MagicMock()
        self.mock_repo_repo = MagicMock()

        app.dependency_overrides[get_review_repo] = lambda: self.mock_review_repo
        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repo_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_get_dashboard_stats(self):
        """Test GET /api/stats returns dashboard statistics."""
        self.mock_repo_repo.count_all.return_value = 5
        self.mock_review_repo.count_all.return_value = 100
        self.mock_review_repo.count_by_status.return_value = {
            "pending": 10,
            "processing": 5,
            "completed": 80,
            "failed": 5,
        }

        response = self.client.get("/api/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["total_repositories"] == 5
        assert data["total_reviews"] == 100
        assert data["reviews_by_status"]["completed"] == 80

    def test_get_stats_empty(self):
        """Test GET /api/stats with no data."""
        self.mock_repo_repo.count_all.return_value = 0
        self.mock_review_repo.count_all.return_value = 0
        self.mock_review_repo.count_by_status.return_value = {
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0,
        }

        response = self.client.get("/api/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["total_repositories"] == 0
        assert data["total_reviews"] == 0
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_api_stats.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.api.stats'`

### Step 3: Add count_by_status to ReviewRepo

Add to `ReviewRepo` class in `backend/app/db/repositories.py`:

```python
    def count_by_status(self) -> dict[str, int]:
        """Count reviews by status."""
        counts = {"pending": 0, "processing": 0, "completed": 0, "failed": 0}

        for status in counts.keys():
            result = (
                self.client.table(self.table)
                .select("*", count="exact")
                .eq("status", status)
                .execute()
            )
            counts[status] = result.count or 0

        return counts
```

### Step 4: Write stats router implementation

```python
# backend/app/api/stats.py
"""Stats API endpoints for dashboard."""

from typing import Annotated, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.db import RepositoryRepo, ReviewRepo
from app.db.database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])


# Dependency injection
def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


# Response model
class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_repositories: int
    total_reviews: int
    reviews_by_status: Dict[str, int]


# Endpoints
@router.get("", response_model=DashboardStats)
def get_dashboard_stats(
    review_repo: Annotated[ReviewRepo, Depends(get_review_repo)] = None,
    repo_repo: Annotated[RepositoryRepo, Depends(get_repository_repo)] = None,
):
    """Get dashboard statistics."""
    return DashboardStats(
        total_repositories=repo_repo.count_all(),
        total_reviews=review_repo.count_all(),
        reviews_by_status=review_repo.count_by_status(),
    )
```

### Step 5: Update api __init__.py

```python
# backend/app/api/__init__.py
"""API routers for CodeGuard AI."""

from app.api.repositories import router as repositories_router
from app.api.reviews import router as reviews_router
from app.api.stats import router as stats_router
from app.api.webhooks import router as webhook_router

__all__ = ["webhook_router", "reviews_router", "repositories_router", "stats_router"]
```

### Step 6: Update main.py to include router

```python
from app.api import webhook_router, reviews_router, repositories_router, stats_router

# Include routers
app.include_router(webhook_router)
app.include_router(reviews_router)
app.include_router(repositories_router)
app.include_router(stats_router)
```

### Step 7: Add test for count_by_status

Add to `backend/tests/test_db_repositories.py`:

```python
class TestReviewRepoStats:
    """Tests for ReviewRepo stats methods."""

    def test_count_by_status(self, mock_supabase_client):
        """Test counting reviews by status."""
        # Mock returns different counts for each status
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.count = 10

        repo = ReviewRepo(mock_supabase_client)
        counts = repo.count_by_status()

        assert "pending" in counts
        assert "completed" in counts
        assert "failed" in counts
```

### Step 8: Run tests to verify they pass

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_api_stats.py tests/test_db_repositories.py::TestReviewRepoStats -v`

Expected: 3 passed

### Step 9: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: ~137 passed

### Step 10: Commit

```bash
git add backend/app/api/stats.py backend/tests/test_api_stats.py backend/app/api/__init__.py backend/app/main.py backend/app/db/repositories.py backend/tests/test_db_repositories.py
git commit -m "feat: add dashboard stats API endpoint"
```

---

## Task 6: Verify Full Integration

### Step 1: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: All tests pass (~137 tests)

### Step 2: Verify server starts

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -c "from app.main import app; print('Routes:', [r.path for r in app.routes])"`

Expected: Should show all routes including:
- `/api/webhook/github`
- `/api/reviews`
- `/api/reviews/{review_id}`
- `/api/repositories`
- `/api/repositories/{repo_id}`
- `/api/repositories/{repo_id}/reviews`
- `/api/repositories/{repo_id}/settings`
- `/api/stats`

### Step 3: Verify OpenAPI docs

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -c "from app.main import app; import json; print(json.dumps([r.path for r in app.routes], indent=2))"`

### Step 4: Commit final integration

```bash
git add .
git commit -m "feat: complete Phase 4 - API endpoints"
```

---

## Summary

After completing all tasks, you will have:

1. **Pagination Models** (`models/pagination.py`) - Generic pagination support
2. **Repository Pagination** - `get_all_paginated()` and `count_all()` methods
3. **Reviews API** (`api/reviews.py`) - List, get, and filter reviews
4. **Repositories API** (`api/repositories.py`) - CRUD for repos + settings
5. **Stats API** (`api/stats.py`) - Dashboard statistics

**New API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | List reviews (paginated) |
| GET | `/api/reviews/{id}` | Get review with findings |
| GET | `/api/repositories/{id}/reviews` | Reviews for a repo |
| GET | `/api/repositories` | List repositories (paginated) |
| POST | `/api/repositories` | Connect new repository |
| GET | `/api/repositories/{id}` | Get repository |
| DELETE | `/api/repositories/{id}` | Delete repository |
| GET | `/api/repositories/{id}/settings` | Get repo settings |
| PUT | `/api/repositories/{id}/settings` | Update settings |
| GET | `/api/stats` | Dashboard statistics |

**Test count:** ~137 tests (107 existing + ~30 new)

**Files created:**
- `backend/app/models/pagination.py`
- `backend/app/api/reviews.py`
- `backend/app/api/repositories.py`
- `backend/app/api/stats.py`
- `backend/tests/test_pagination_models.py`
- `backend/tests/test_api_reviews.py`
- `backend/tests/test_api_repositories.py`
- `backend/tests/test_api_stats.py`
