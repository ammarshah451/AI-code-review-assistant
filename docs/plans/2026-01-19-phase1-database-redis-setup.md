# Phase 1.2-1.3: Database & Redis Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up Supabase database client with repository pattern and Upstash Redis queue service for rate limiting.

**Architecture:** Use Supabase Python client for database operations with a repository pattern for clean data access. Use Upstash Redis REST client for job queuing and rate limiting to stay within Gemini's 15 RPM free tier limit.

**Tech Stack:** supabase-py, upstash-redis, pydantic models, pytest-asyncio

---

## Prerequisites

Before starting, ensure you have:
1. Created a Supabase project at https://supabase.com
2. Run the SQL schema from `implementation_plan.md` Phase 1.2 in Supabase SQL Editor
3. Created an Upstash Redis instance at https://upstash.com
4. Copied `.env.example` to `.env` and filled in credentials

---

## Task 1: Create Pydantic Models for Database Entities

**Files:**
- Create: `backend/app/models/repository.py`
- Create: `backend/app/models/review.py`
- Create: `backend/app/models/finding.py`
- Create: `backend/app/models/settings.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create Repository model**

```python
# backend/app/models/repository.py
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
```

**Step 2: Create Review model**

```python
# backend/app/models/review.py
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
```

**Step 3: Create Finding model**

```python
# backend/app/models/finding.py
"""Finding model for individual review findings."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AgentType(str, Enum):
    """Agent type enum."""
    LOGIC = "logic"
    SECURITY = "security"
    QUALITY = "quality"


class Severity(str, Enum):
    """Severity level enum."""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class FindingBase(BaseModel):
    """Base finding schema."""
    agent_type: AgentType
    severity: Severity
    file_path: str
    line_number: Optional[int] = None
    title: str
    description: str
    suggestion: Optional[str] = None


class FindingCreate(FindingBase):
    """Schema for creating a finding."""
    review_id: UUID


class Finding(FindingBase):
    """Finding schema with database fields."""
    id: UUID
    review_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
```

**Step 4: Create Settings model**

```python
# backend/app/models/settings.py
"""Settings model for per-repository configuration."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.finding import Severity


class AgentsEnabled(BaseModel):
    """Which agents are enabled."""
    logic: bool = True
    security: bool = True
    quality: bool = True


class SettingsBase(BaseModel):
    """Base settings schema."""
    enabled: bool = True
    agents_enabled: AgentsEnabled = Field(default_factory=AgentsEnabled)
    severity_threshold: Severity = Severity.INFO


class SettingsCreate(SettingsBase):
    """Schema for creating settings."""
    repository_id: UUID


class SettingsUpdate(BaseModel):
    """Schema for updating settings."""
    enabled: Optional[bool] = None
    agents_enabled: Optional[AgentsEnabled] = None
    severity_threshold: Optional[Severity] = None


class Settings(SettingsBase):
    """Settings schema with database fields."""
    id: UUID
    repository_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Step 5: Update models __init__.py**

```python
# backend/app/models/__init__.py
"""Pydantic models for CodeGuard AI."""

from app.models.finding import (
    AgentType,
    Finding,
    FindingBase,
    FindingCreate,
    Severity,
)
from app.models.repository import Repository, RepositoryBase, RepositoryCreate
from app.models.review import Review, ReviewBase, ReviewCreate, ReviewStatus
from app.models.settings import (
    AgentsEnabled,
    Settings,
    SettingsBase,
    SettingsCreate,
    SettingsUpdate,
)

__all__ = [
    # Finding
    "AgentType",
    "Finding",
    "FindingBase",
    "FindingCreate",
    "Severity",
    # Repository
    "Repository",
    "RepositoryBase",
    "RepositoryCreate",
    # Review
    "Review",
    "ReviewBase",
    "ReviewCreate",
    "ReviewStatus",
    # Settings
    "AgentsEnabled",
    "Settings",
    "SettingsBase",
    "SettingsCreate",
    "SettingsUpdate",
]
```

**Step 6: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add Pydantic models for database entities

- Repository, Review, Finding, Settings models
- Base, Create, and full schemas for each entity
- Enums for AgentType, Severity, ReviewStatus

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Supabase Database Client

**Files:**
- Create: `backend/app/db/database.py`
- Modify: `backend/app/db/__init__.py`

**Step 1: Create database client**

```python
# backend/app/db/database.py
"""Supabase database client setup."""

from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_supabase_client() -> Client:
    """Get cached Supabase client instance."""
    if not settings.supabase_url or not settings.supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

    return create_client(settings.supabase_url, settings.supabase_key)


def get_db() -> Client:
    """Dependency for getting database client."""
    return get_supabase_client()
```

**Step 2: Update db __init__.py**

```python
# backend/app/db/__init__.py
"""Database module for CodeGuard AI."""

from app.db.database import get_db, get_supabase_client

__all__ = ["get_db", "get_supabase_client"]
```

**Step 3: Commit**

```bash
git add backend/app/db/
git commit -m "feat: add Supabase database client

- Cached client with lru_cache
- Dependency injection helper for FastAPI

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Repository Pattern for Data Access

**Files:**
- Create: `backend/app/db/repositories.py`
- Modify: `backend/app/db/__init__.py`

**Step 1: Write failing test for repository operations**

```python
# backend/tests/test_db_repositories.py
"""Tests for database repository operations."""

import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.db.repositories import RepositoryRepo, ReviewRepo, FindingRepo, SettingsRepo
from app.models import (
    RepositoryCreate,
    ReviewCreate,
    FindingCreate,
    SettingsCreate,
    AgentType,
    Severity,
    ReviewStatus,
)


class TestRepositoryRepo:
    """Tests for RepositoryRepo."""

    def test_create_repository(self):
        """Test creating a repository."""
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "github_id": 123456,
                "full_name": "owner/repo",
                "webhook_secret": "secret",
                "created_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = RepositoryRepo(mock_client)
        result = repo.create(RepositoryCreate(github_id=123456, full_name="owner/repo"))

        assert result.github_id == 123456
        assert result.full_name == "owner/repo"
        mock_client.table.assert_called_with("repositories")

    def test_get_by_github_id(self):
        """Test getting repository by GitHub ID."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "github_id": 123456,
                "full_name": "owner/repo",
                "webhook_secret": None,
                "created_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = RepositoryRepo(mock_client)
        result = repo.get_by_github_id(123456)

        assert result is not None
        assert result.github_id == 123456

    def test_get_by_github_id_not_found(self):
        """Test getting non-existent repository."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        repo = RepositoryRepo(mock_client)
        result = repo.get_by_github_id(999999)

        assert result is None
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_db_repositories.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.db.repositories'"

**Step 3: Create repository pattern implementation**

```python
# backend/app/db/repositories.py
"""Repository pattern for database operations."""

from typing import List, Optional
from uuid import UUID

from supabase import Client

from app.models import (
    Finding,
    FindingCreate,
    Repository,
    RepositoryCreate,
    Review,
    ReviewCreate,
    ReviewStatus,
    Settings,
    SettingsCreate,
    SettingsUpdate,
)


class RepositoryRepo:
    """Repository operations for GitHub repositories."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "repositories"

    def create(self, data: RepositoryCreate) -> Repository:
        """Create a new repository."""
        result = (
            self.client.table(self.table)
            .insert(data.model_dump())
            .execute()
        )
        return Repository(**result.data[0])

    def get_by_id(self, id: UUID) -> Optional[Repository]:
        """Get repository by ID."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("id", str(id))
            .execute()
        )
        if result.data:
            return Repository(**result.data[0])
        return None

    def get_by_github_id(self, github_id: int) -> Optional[Repository]:
        """Get repository by GitHub ID."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("github_id", github_id)
            .execute()
        )
        if result.data:
            return Repository(**result.data[0])
        return None

    def get_all(self) -> List[Repository]:
        """Get all repositories."""
        result = self.client.table(self.table).select("*").execute()
        return [Repository(**row) for row in result.data]

    def delete(self, id: UUID) -> bool:
        """Delete a repository."""
        result = (
            self.client.table(self.table)
            .delete()
            .eq("id", str(id))
            .execute()
        )
        return len(result.data) > 0


class ReviewRepo:
    """Repository operations for PR reviews."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "reviews"

    def create(self, data: ReviewCreate) -> Review:
        """Create a new review."""
        insert_data = data.model_dump()
        insert_data["repository_id"] = str(data.repository_id)
        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return Review(**result.data[0])

    def get_by_id(self, id: UUID) -> Optional[Review]:
        """Get review by ID."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("id", str(id))
            .execute()
        )
        if result.data:
            return Review(**result.data[0])
        return None

    def get_by_repository(
        self, repository_id: UUID, limit: int = 50
    ) -> List[Review]:
        """Get reviews for a repository."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("repository_id", str(repository_id))
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [Review(**row) for row in result.data]

    def update_status(
        self, id: UUID, status: ReviewStatus, comment_id: Optional[int] = None
    ) -> Optional[Review]:
        """Update review status."""
        update_data = {"status": status.value}
        if comment_id is not None:
            update_data["comment_id"] = comment_id
        if status == ReviewStatus.COMPLETED:
            update_data["completed_at"] = "now()"

        result = (
            self.client.table(self.table)
            .update(update_data)
            .eq("id", str(id))
            .execute()
        )
        if result.data:
            return Review(**result.data[0])
        return None


class FindingRepo:
    """Repository operations for review findings."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "findings"

    def create(self, data: FindingCreate) -> Finding:
        """Create a new finding."""
        insert_data = data.model_dump()
        insert_data["review_id"] = str(data.review_id)
        insert_data["agent_type"] = data.agent_type.value
        insert_data["severity"] = data.severity.value
        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return Finding(**result.data[0])

    def create_many(self, findings: List[FindingCreate]) -> List[Finding]:
        """Create multiple findings."""
        if not findings:
            return []
        insert_data = []
        for f in findings:
            d = f.model_dump()
            d["review_id"] = str(f.review_id)
            d["agent_type"] = f.agent_type.value
            d["severity"] = f.severity.value
            insert_data.append(d)

        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return [Finding(**row) for row in result.data]

    def get_by_review(self, review_id: UUID) -> List[Finding]:
        """Get all findings for a review."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("review_id", str(review_id))
            .order("severity")
            .execute()
        )
        return [Finding(**row) for row in result.data]


class SettingsRepo:
    """Repository operations for repository settings."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "settings"

    def create(self, data: SettingsCreate) -> Settings:
        """Create settings for a repository."""
        insert_data = data.model_dump()
        insert_data["repository_id"] = str(data.repository_id)
        insert_data["agents_enabled"] = data.agents_enabled.model_dump()
        insert_data["severity_threshold"] = data.severity_threshold.value
        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return Settings(**result.data[0])

    def get_by_repository(self, repository_id: UUID) -> Optional[Settings]:
        """Get settings for a repository."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("repository_id", str(repository_id))
            .execute()
        )
        if result.data:
            return Settings(**result.data[0])
        return None

    def update(
        self, repository_id: UUID, data: SettingsUpdate
    ) -> Optional[Settings]:
        """Update repository settings."""
        update_data = data.model_dump(exclude_unset=True)
        if "agents_enabled" in update_data and update_data["agents_enabled"]:
            update_data["agents_enabled"] = update_data["agents_enabled"].model_dump()
        if "severity_threshold" in update_data and update_data["severity_threshold"]:
            update_data["severity_threshold"] = update_data["severity_threshold"].value
        update_data["updated_at"] = "now()"

        result = (
            self.client.table(self.table)
            .update(update_data)
            .eq("repository_id", str(repository_id))
            .execute()
        )
        if result.data:
            return Settings(**result.data[0])
        return None

    def get_or_create(self, repository_id: UUID) -> Settings:
        """Get settings or create default if not exists."""
        existing = self.get_by_repository(repository_id)
        if existing:
            return existing
        return self.create(SettingsCreate(repository_id=repository_id))
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_db_repositories.py -v`
Expected: PASS

**Step 5: Update db __init__.py**

```python
# backend/app/db/__init__.py
"""Database module for CodeGuard AI."""

from app.db.database import get_db, get_supabase_client
from app.db.repositories import (
    FindingRepo,
    RepositoryRepo,
    ReviewRepo,
    SettingsRepo,
)

__all__ = [
    "get_db",
    "get_supabase_client",
    "FindingRepo",
    "RepositoryRepo",
    "ReviewRepo",
    "SettingsRepo",
]
```

**Step 6: Commit**

```bash
git add backend/app/db/ backend/tests/
git commit -m "feat: add repository pattern for database operations

- RepositoryRepo, ReviewRepo, FindingRepo, SettingsRepo
- CRUD operations with Supabase client
- Unit tests with mocked client

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Redis Queue Service

**Files:**
- Create: `backend/app/services/queue.py`
- Modify: `backend/app/services/__init__.py`

**Step 1: Write failing test for queue service**

```python
# backend/tests/test_queue_service.py
"""Tests for Redis queue service."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4

from app.services.queue import QueueService, RateLimiter


class TestRateLimiter:
    """Tests for rate limiter."""

    @pytest.mark.asyncio
    async def test_can_proceed_under_limit(self):
        """Test that requests under limit are allowed."""
        mock_redis = MagicMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock()

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = await limiter.can_proceed("gemini")

        assert result is True

    @pytest.mark.asyncio
    async def test_cannot_proceed_at_limit(self):
        """Test that requests at limit are blocked."""
        mock_redis = MagicMock()
        mock_redis.get = AsyncMock(return_value="15")

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = await limiter.can_proceed("gemini")

        assert result is False


class TestQueueService:
    """Tests for queue service."""

    @pytest.mark.asyncio
    async def test_enqueue_review(self):
        """Test enqueueing a review job."""
        mock_redis = MagicMock()
        mock_redis.lpush = AsyncMock(return_value=1)

        queue = QueueService(mock_redis)
        job_id = str(uuid4())
        await queue.enqueue_review(job_id, {"pr_number": 1})

        mock_redis.lpush.assert_called_once()

    @pytest.mark.asyncio
    async def test_dequeue_review(self):
        """Test dequeueing a review job."""
        mock_redis = MagicMock()
        job_data = '{"job_id": "123", "data": {"pr_number": 1}}'
        mock_redis.rpop = AsyncMock(return_value=job_data)

        queue = QueueService(mock_redis)
        result = await queue.dequeue_review()

        assert result is not None
        assert result["data"]["pr_number"] == 1
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_queue_service.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.services.queue'"

**Step 3: Create queue service implementation**

```python
# backend/app/services/queue.py
"""Redis queue service for job management and rate limiting."""

import json
from datetime import datetime
from typing import Any, Dict, Optional

from upstash_redis import Redis

from app.config import settings


def get_redis_client() -> Redis:
    """Get Upstash Redis client."""
    if not settings.upstash_redis_rest_url or not settings.upstash_redis_rest_token:
        raise ValueError("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set")

    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    )


class RateLimiter:
    """Rate limiter using Redis sliding window."""

    def __init__(
        self,
        redis: Redis,
        max_requests: int = 15,
        window_seconds: int = 60,
    ):
        self.redis = redis
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def can_proceed(self, key: str) -> bool:
        """Check if request can proceed under rate limit."""
        rate_key = f"rate_limit:{key}"
        current = await self.redis.get(rate_key)

        if current is not None and int(current) >= self.max_requests:
            return False

        return True

    async def increment(self, key: str) -> int:
        """Increment rate limit counter."""
        rate_key = f"rate_limit:{key}"
        count = await self.redis.incr(rate_key)

        if count == 1:
            await self.redis.expire(rate_key, self.window_seconds)

        return count

    async def get_remaining(self, key: str) -> int:
        """Get remaining requests in current window."""
        rate_key = f"rate_limit:{key}"
        current = await self.redis.get(rate_key)

        if current is None:
            return self.max_requests

        return max(0, self.max_requests - int(current))


class QueueService:
    """Redis-based job queue for review processing."""

    QUEUE_KEY = "codeguard:review_queue"

    def __init__(self, redis: Redis):
        self.redis = redis

    async def enqueue_review(
        self, job_id: str, data: Dict[str, Any], priority: int = 0
    ) -> None:
        """Add a review job to the queue."""
        job = {
            "job_id": job_id,
            "data": data,
            "priority": priority,
            "created_at": datetime.utcnow().isoformat(),
        }
        await self.redis.lpush(self.QUEUE_KEY, json.dumps(job))

    async def dequeue_review(self) -> Optional[Dict[str, Any]]:
        """Get next review job from queue."""
        job_data = await self.redis.rpop(self.QUEUE_KEY)

        if job_data is None:
            return None

        return json.loads(job_data)

    async def queue_length(self) -> int:
        """Get current queue length."""
        return await self.redis.llen(self.QUEUE_KEY)

    async def set_job_status(
        self, job_id: str, status: str, result: Optional[Dict] = None
    ) -> None:
        """Set job status in Redis."""
        status_key = f"codeguard:job:{job_id}"
        status_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if result:
            status_data["result"] = result

        await self.redis.set(status_key, json.dumps(status_data))
        await self.redis.expire(status_key, 3600)  # 1 hour TTL

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status from Redis."""
        status_key = f"codeguard:job:{job_id}"
        data = await self.redis.get(status_key)

        if data is None:
            return None

        return json.loads(data)
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_queue_service.py -v`
Expected: PASS

**Step 5: Update services __init__.py**

```python
# backend/app/services/__init__.py
"""Services module for CodeGuard AI."""

from app.services.queue import QueueService, RateLimiter, get_redis_client

__all__ = ["QueueService", "RateLimiter", "get_redis_client"]
```

**Step 6: Commit**

```bash
git add backend/app/services/ backend/tests/
git commit -m "feat: add Redis queue service with rate limiting

- QueueService for job queue management
- RateLimiter for Gemini API rate limiting (15 RPM)
- Upstash Redis REST client integration

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Database and Queue Dependencies to FastAPI

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Update main.py with dependency injection**

```python
# backend/app/main.py
"""CodeGuard AI - FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client

from app.config import settings
from app.db import get_db, RepositoryRepo, ReviewRepo, FindingRepo, SettingsRepo
from app.services.queue import get_redis_client, QueueService, RateLimiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    # Startup
    print(f"Starting CodeGuard AI in {settings.environment} mode")
    yield
    # Shutdown
    print("Shutting down CodeGuard AI")


app = FastAPI(
    title="CodeGuard AI",
    description="Multi-agent PR review system for GitHub pull requests",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency injection
def get_repository_repo(db: Annotated[Client, Depends(get_db)]) -> RepositoryRepo:
    """Get RepositoryRepo instance."""
    return RepositoryRepo(db)


def get_review_repo(db: Annotated[Client, Depends(get_db)]) -> ReviewRepo:
    """Get ReviewRepo instance."""
    return ReviewRepo(db)


def get_finding_repo(db: Annotated[Client, Depends(get_db)]) -> FindingRepo:
    """Get FindingRepo instance."""
    return FindingRepo(db)


def get_settings_repo(db: Annotated[Client, Depends(get_db)]) -> SettingsRepo:
    """Get SettingsRepo instance."""
    return SettingsRepo(db)


def get_queue_service() -> QueueService:
    """Get QueueService instance."""
    return QueueService(get_redis_client())


def get_rate_limiter() -> RateLimiter:
    """Get RateLimiter instance for Gemini API."""
    return RateLimiter(get_redis_client(), max_requests=15, window_seconds=60)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "CodeGuard AI API",
        "docs": "/docs",
        "health": "/health",
    }
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add dependency injection for DB and queue services

- Repository dependency providers
- Queue and rate limiter dependencies
- Ready for endpoint implementation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create pytest Configuration

**Files:**
- Create: `backend/pytest.ini`
- Create: `backend/tests/conftest.py`

**Step 1: Create pytest.ini**

```ini
# backend/pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts = -v --tb=short
```

**Step 2: Create conftest.py with fixtures**

```python
# backend/tests/conftest.py
"""Pytest fixtures for CodeGuard AI tests."""

import pytest
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client."""
    client = MagicMock()
    return client


@pytest.fixture
def mock_redis_client():
    """Mock Redis client."""
    client = MagicMock()
    client.get = AsyncMock(return_value=None)
    client.set = AsyncMock()
    client.incr = AsyncMock(return_value=1)
    client.expire = AsyncMock()
    client.lpush = AsyncMock(return_value=1)
    client.rpop = AsyncMock(return_value=None)
    client.llen = AsyncMock(return_value=0)
    return client
```

**Step 3: Commit**

```bash
git add backend/pytest.ini backend/tests/conftest.py
git commit -m "feat: add pytest configuration and fixtures

- pytest.ini with async mode
- conftest.py with mock clients

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Verify All Tests Pass

**Step 1: Install dependencies**

Run: `cd backend && pip install -r requirements.txt`

**Step 2: Run all tests**

Run: `cd backend && python -m pytest`
Expected: All tests PASS

**Step 3: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: address any test failures

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

After completing this plan, you will have:

1. **Pydantic Models** - Type-safe models for Repository, Review, Finding, Settings
2. **Supabase Client** - Database connection with caching
3. **Repository Pattern** - Clean data access layer with CRUD operations
4. **Redis Queue Service** - Job queue with rate limiting for Gemini API
5. **FastAPI Dependencies** - Dependency injection ready for endpoints
6. **Test Infrastructure** - pytest config and fixtures

**Next Phase:** Phase 2 - GitHub Integration (webhooks and API client)
