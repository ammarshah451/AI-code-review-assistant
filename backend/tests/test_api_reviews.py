# backend/tests/test_api_reviews.py
"""Tests for reviews API endpoints."""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.reviews import get_finding_repo, get_review_repo
from app.main import app
from app.models import AgentType, Finding, Review, ReviewStatus, Severity


class TestListReviews:
    """Tests for GET /api/reviews endpoint."""

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
        """Test listing reviews returns paginated response."""
        review_id = uuid4()
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        mock_reviews = [
            Review(
                id=review_id,
                repository_id=repo_id,
                pr_number=42,
                pr_title="Test PR",
                commit_sha="abc123",
                status=ReviewStatus.COMPLETED,
                comment_id=None,
                created_at=now,
                completed_at=now,
            )
        ]
        self.mock_review_repo.get_all_paginated.return_value = (mock_reviews, 1)

        response = self.client.get("/api/reviews")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["page"] == 1
        assert data["per_page"] == 20
        assert data["pages"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["pr_number"] == 42

    def test_list_reviews_with_pagination(self):
        """Test listing reviews with custom pagination parameters."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        # Create 5 mock reviews
        mock_reviews = [
            Review(
                id=uuid4(),
                repository_id=repo_id,
                pr_number=i,
                pr_title=f"PR {i}",
                commit_sha=f"sha{i}",
                status=ReviewStatus.PENDING,
                comment_id=None,
                created_at=now,
                completed_at=None,
            )
            for i in range(5)
        ]
        self.mock_review_repo.get_all_paginated.return_value = (mock_reviews, 25)

        response = self.client.get("/api/reviews?page=2&per_page=5")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 25
        assert data["page"] == 2
        assert data["per_page"] == 5
        assert data["pages"] == 5
        assert len(data["items"]) == 5

        # Verify repo was called with correct offset
        self.mock_review_repo.get_all_paginated.assert_called_once_with(
            offset=5, limit=5
        )


class TestGetReviewById:
    """Tests for GET /api/reviews/{review_id} endpoint."""

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

    def test_get_review_by_id(self):
        """Test getting a review by ID returns review with findings."""
        review_id = uuid4()
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        mock_review = Review(
            id=review_id,
            repository_id=repo_id,
            pr_number=42,
            pr_title="Test PR",
            commit_sha="abc123",
            status=ReviewStatus.COMPLETED,
            comment_id=100,
            created_at=now,
            completed_at=now,
        )
        self.mock_review_repo.get_by_id.return_value = mock_review

        mock_findings = [
            Finding(
                id=uuid4(),
                review_id=review_id,
                agent_type=AgentType.SECURITY,
                severity=Severity.MEDIUM,
                file_path="app.py",
                line_number=10,
                title="SQL Injection Risk",
                description="Found potential SQL injection",
                suggestion="Use parameterized queries",
                created_at=now,
            )
        ]
        self.mock_finding_repo.get_by_review.return_value = mock_findings

        response = self.client.get(f"/api/reviews/{review_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(review_id)
        assert data["pr_number"] == 42
        assert data["status"] == "completed"
        assert len(data["findings"]) == 1
        assert data["findings"][0]["title"] == "SQL Injection Risk"

    def test_get_review_not_found(self):
        """Test getting a non-existent review returns 404."""
        review_id = uuid4()
        self.mock_review_repo.get_by_id.return_value = None

        response = self.client.get(f"/api/reviews/{review_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Review not found"


class TestGetReviewsByRepository:
    """Tests for GET /api/repositories/{repo_id}/reviews endpoint."""

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

    def test_get_reviews_by_repository(self):
        """Test getting reviews for a repository."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        mock_reviews = [
            Review(
                id=uuid4(),
                repository_id=repo_id,
                pr_number=1,
                pr_title="First PR",
                commit_sha="sha1",
                status=ReviewStatus.COMPLETED,
                comment_id=None,
                created_at=now,
                completed_at=now,
            ),
            Review(
                id=uuid4(),
                repository_id=repo_id,
                pr_number=2,
                pr_title="Second PR",
                commit_sha="sha2",
                status=ReviewStatus.PENDING,
                comment_id=None,
                created_at=now,
                completed_at=None,
            ),
        ]
        self.mock_review_repo.get_by_repository.return_value = mock_reviews

        response = self.client.get(f"/api/repositories/{repo_id}/reviews")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["pr_number"] == 1
        assert data[1]["pr_number"] == 2

        # Verify repo was called with correct parameters
        self.mock_review_repo.get_by_repository.assert_called_once_with(
            repo_id, limit=50
        )

    def test_get_reviews_by_repository_with_limit(self):
        """Test getting reviews for a repository with custom limit."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        mock_reviews = [
            Review(
                id=uuid4(),
                repository_id=repo_id,
                pr_number=i,
                pr_title=f"PR {i}",
                commit_sha=f"sha{i}",
                status=ReviewStatus.PENDING,
                comment_id=None,
                created_at=now,
                completed_at=None,
            )
            for i in range(10)
        ]
        self.mock_review_repo.get_by_repository.return_value = mock_reviews

        response = self.client.get(f"/api/repositories/{repo_id}/reviews?limit=10")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 10

        # Verify repo was called with custom limit
        self.mock_review_repo.get_by_repository.assert_called_once_with(
            repo_id, limit=10
        )
