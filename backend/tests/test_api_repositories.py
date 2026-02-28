# backend/tests/test_api_repositories.py
"""Tests for repositories API endpoints."""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.repositories import get_repository_repo, get_settings_repo
from app.main import app
from app.models import AgentsEnabled, Repository, Settings, Severity


class TestListRepositories:
    """Tests for GET /api/repositories endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_list_repositories(self):
        """Test listing repositories returns paginated response."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        mock_repositories = [
            Repository(
                id=repo_id,
                github_id=123456,
                full_name="owner/repo",
                webhook_secret=None,
                created_at=now,
            )
        ]
        self.mock_repository_repo.get_all_paginated.return_value = (mock_repositories, 1)

        response = self.client.get("/api/repositories")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["page"] == 1
        assert data["per_page"] == 20
        assert data["pages"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["github_id"] == 123456
        assert data["items"][0]["full_name"] == "owner/repo"


class TestCreateRepository:
    """Tests for POST /api/repositories endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_create_repository(self):
        """Test creating a new repository."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        self.mock_repository_repo.get_by_github_id.return_value = None
        self.mock_repository_repo.create.return_value = Repository(
            id=repo_id,
            github_id=123456,
            full_name="owner/repo",
            webhook_secret=None,
            created_at=now,
        )

        response = self.client.post(
            "/api/repositories",
            json={"github_id": 123456, "full_name": "owner/repo"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["github_id"] == 123456
        assert data["full_name"] == "owner/repo"

    def test_create_repository_already_exists(self):
        """Test creating a repository that already exists returns 409."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        self.mock_repository_repo.get_by_github_id.return_value = Repository(
            id=repo_id,
            github_id=123456,
            full_name="owner/repo",
            webhook_secret=None,
            created_at=now,
        )

        response = self.client.post(
            "/api/repositories",
            json={"github_id": 123456, "full_name": "owner/repo"},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "Repository with this GitHub ID already exists"


class TestGetRepository:
    """Tests for GET /api/repositories/{repo_id} endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_get_repository(self):
        """Test getting a repository by ID."""
        repo_id = uuid4()
        now = datetime.now(timezone.utc)

        self.mock_repository_repo.get_by_id.return_value = Repository(
            id=repo_id,
            github_id=123456,
            full_name="owner/repo",
            webhook_secret=None,
            created_at=now,
        )

        response = self.client.get(f"/api/repositories/{repo_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(repo_id)
        assert data["github_id"] == 123456
        assert data["full_name"] == "owner/repo"

    def test_get_repository_not_found(self):
        """Test getting a non-existent repository returns 404."""
        repo_id = uuid4()
        self.mock_repository_repo.get_by_id.return_value = None

        response = self.client.get(f"/api/repositories/{repo_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Repository not found"


class TestDeleteRepository:
    """Tests for DELETE /api/repositories/{repo_id} endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_delete_repository(self):
        """Test deleting a repository."""
        repo_id = uuid4()
        self.mock_repository_repo.delete.return_value = True

        response = self.client.delete(f"/api/repositories/{repo_id}")

        assert response.status_code == 204
        self.mock_repository_repo.delete.assert_called_once_with(repo_id)


class TestGetRepositorySettings:
    """Tests for GET /api/repositories/{repo_id}/settings endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_get_repository_settings(self):
        """Test getting settings for a repository."""
        repo_id = uuid4()
        settings_id = uuid4()
        now = datetime.now(timezone.utc)

        self.mock_settings_repo.get_or_create.return_value = Settings(
            id=settings_id,
            repository_id=repo_id,
            enabled=True,
            agents_enabled=AgentsEnabled(logic=True, security=True, quality=True),
            severity_threshold=Severity.INFO,
            created_at=now,
            updated_at=now,
        )

        response = self.client.get(f"/api/repositories/{repo_id}/settings")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(settings_id)
        assert data["repository_id"] == str(repo_id)
        assert data["enabled"] is True
        assert data["agents_enabled"]["logic"] is True
        assert data["severity_threshold"] == "info"

        self.mock_settings_repo.get_or_create.assert_called_once_with(repo_id)


class TestUpdateRepositorySettings:
    """Tests for PUT /api/repositories/{repo_id}/settings endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        self.mock_repository_repo = MagicMock()
        self.mock_settings_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repository_repo
        app.dependency_overrides[get_settings_repo] = lambda: self.mock_settings_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_update_repository_settings(self):
        """Test updating settings for a repository."""
        repo_id = uuid4()
        settings_id = uuid4()
        now = datetime.now(timezone.utc)

        self.mock_settings_repo.update.return_value = Settings(
            id=settings_id,
            repository_id=repo_id,
            enabled=False,
            agents_enabled=AgentsEnabled(logic=True, security=False, quality=True),
            severity_threshold=Severity.MEDIUM,
            created_at=now,
            updated_at=now,
        )

        response = self.client.put(
            f"/api/repositories/{repo_id}/settings",
            json={
                "enabled": False,
                "agents_enabled": {"logic": True, "security": False, "quality": True},
                "severity_threshold": "medium",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["agents_enabled"]["security"] is False
        assert data["severity_threshold"] == "medium"

    def test_update_settings_not_found(self):
        """Test updating settings that don't exist returns 404."""
        repo_id = uuid4()
        self.mock_settings_repo.update.return_value = None

        response = self.client.put(
            f"/api/repositories/{repo_id}/settings",
            json={"enabled": False},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Settings not found"
