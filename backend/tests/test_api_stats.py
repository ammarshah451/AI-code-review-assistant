# backend/tests/test_api_stats.py
"""Tests for stats API endpoints."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.stats import get_repository_repo, get_review_repo
from app.main import app


class TestGetDashboardStats:
    """Tests for GET /api/stats endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_review_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_review_repo] = lambda: self.mock_review_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_get_dashboard_stats(self):
        """Test getting dashboard statistics."""
        self.mock_repository_repo.count_all.return_value = 5
        self.mock_review_repo.count_all.return_value = 20
        self.mock_review_repo.count_by_status.return_value = {
            "pending": 3,
            "processing": 2,
            "completed": 12,
            "failed": 3,
        }

        response = self.client.get("/api/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["total_repositories"] == 5
        assert data["total_reviews"] == 20
        assert data["reviews_by_status"] == {
            "pending": 3,
            "processing": 2,
            "completed": 12,
            "failed": 3,
        }

    def test_get_stats_empty(self):
        """Test getting dashboard statistics with no data."""
        self.mock_repository_repo.count_all.return_value = 0
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
        assert data["reviews_by_status"] == {
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0,
        }
