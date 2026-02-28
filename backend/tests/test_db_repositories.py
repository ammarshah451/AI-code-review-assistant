"""Tests for database repository operations."""

import pytest
from unittest.mock import MagicMock
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

    def test_get_by_id(self):
        """Test getting repository by ID."""
        repo_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(repo_id),
                "github_id": 123456,
                "full_name": "owner/repo",
                "webhook_secret": None,
                "created_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = RepositoryRepo(mock_client)
        result = repo.get_by_id(repo_id)

        assert result is not None
        assert result.id == repo_id

    def test_get_all(self):
        """Test getting all repositories."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "github_id": 123456,
                "full_name": "owner/repo1",
                "webhook_secret": None,
                "created_at": "2026-01-19T00:00:00Z",
            },
            {
                "id": str(uuid4()),
                "github_id": 789012,
                "full_name": "owner/repo2",
                "webhook_secret": None,
                "created_at": "2026-01-19T00:00:00Z",
            },
        ]

        repo = RepositoryRepo(mock_client)
        result = repo.get_all()

        assert len(result) == 2
        assert result[0].full_name == "owner/repo1"
        assert result[1].full_name == "owner/repo2"

    def test_delete_repository(self):
        """Test deleting a repository."""
        repo_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [
            {"id": str(repo_id)}
        ]

        repo = RepositoryRepo(mock_client)
        result = repo.delete(repo_id)

        assert result is True


class TestRepositoryRepoPagination:
    """Tests for RepositoryRepo pagination methods."""

    def test_get_all_paginated(self):
        """Test getting paginated repositories."""
        mock_client = MagicMock()
        # Mock paginated data response
        mock_client.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "github_id": 123456,
                "full_name": "owner/repo1",
                "webhook_secret": None,
                "created_at": "2026-01-19T00:00:00Z",
            },
            {
                "id": str(uuid4()),
                "github_id": 789012,
                "full_name": "owner/repo2",
                "webhook_secret": None,
                "created_at": "2026-01-19T00:00:00Z",
            },
        ]
        # Mock count response
        mock_count_result = MagicMock()
        mock_count_result.count = 5
        mock_client.table.return_value.select.return_value.execute.return_value = mock_count_result

        repo = RepositoryRepo(mock_client)
        result, total = repo.get_all_paginated(offset=0, limit=2)

        assert len(result) == 2
        assert result[0].full_name == "owner/repo1"
        assert result[1].full_name == "owner/repo2"
        assert total == 5

    def test_count_all(self):
        """Test counting all repositories."""
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.count = 10
        mock_client.table.return_value.select.return_value.execute.return_value = mock_result

        repo = RepositoryRepo(mock_client)
        result = repo.count_all()

        assert result == 10


class TestReviewRepo:
    """Tests for ReviewRepo."""

    def test_create_review(self):
        """Test creating a review."""
        repo_id = uuid4()
        review_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": str(review_id),
                "repository_id": str(repo_id),
                "pr_number": 42,
                "pr_title": "Fix bug",
                "commit_sha": "abc123",
                "status": "pending",
                "comment_id": None,
                "created_at": "2026-01-19T00:00:00Z",
                "completed_at": None,
            }
        ]

        repo = ReviewRepo(mock_client)
        result = repo.create(
            ReviewCreate(
                repository_id=repo_id,
                pr_number=42,
                pr_title="Fix bug",
                commit_sha="abc123",
            )
        )

        assert result.pr_number == 42
        assert result.pr_title == "Fix bug"
        assert result.status == ReviewStatus.PENDING

    def test_get_by_id(self):
        """Test getting review by ID."""
        review_id = uuid4()
        repo_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(review_id),
                "repository_id": str(repo_id),
                "pr_number": 42,
                "pr_title": "Fix bug",
                "commit_sha": "abc123",
                "status": "pending",
                "comment_id": None,
                "created_at": "2026-01-19T00:00:00Z",
                "completed_at": None,
            }
        ]

        repo = ReviewRepo(mock_client)
        result = repo.get_by_id(review_id)

        assert result is not None
        assert result.id == review_id

    def test_get_by_repository(self):
        """Test getting reviews by repository."""
        repo_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "repository_id": str(repo_id),
                "pr_number": 42,
                "pr_title": "Fix bug",
                "commit_sha": "abc123",
                "status": "completed",
                "comment_id": 100,
                "created_at": "2026-01-19T00:00:00Z",
                "completed_at": "2026-01-19T01:00:00Z",
            }
        ]

        repo = ReviewRepo(mock_client)
        result = repo.get_by_repository(repo_id)

        assert len(result) == 1
        assert result[0].pr_number == 42

    def test_update_status(self):
        """Test updating review status."""
        review_id = uuid4()
        repo_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(review_id),
                "repository_id": str(repo_id),
                "pr_number": 42,
                "pr_title": "Fix bug",
                "commit_sha": "abc123",
                "status": "completed",
                "comment_id": 100,
                "created_at": "2026-01-19T00:00:00Z",
                "completed_at": "2026-01-19T01:00:00Z",
            }
        ]

        repo = ReviewRepo(mock_client)
        result = repo.update_status(review_id, ReviewStatus.COMPLETED, comment_id=100)

        assert result is not None
        assert result.status == ReviewStatus.COMPLETED
        assert result.comment_id == 100


class TestReviewRepoPagination:
    """Tests for ReviewRepo pagination methods."""

    def test_get_all_paginated(self):
        """Test getting paginated reviews."""
        repo_id = uuid4()
        mock_client = MagicMock()
        # Mock paginated data response
        mock_client.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "repository_id": str(repo_id),
                "pr_number": 42,
                "pr_title": "Fix bug",
                "commit_sha": "abc123",
                "status": "pending",
                "comment_id": None,
                "created_at": "2026-01-19T00:00:00Z",
                "completed_at": None,
            },
            {
                "id": str(uuid4()),
                "repository_id": str(repo_id),
                "pr_number": 43,
                "pr_title": "Add feature",
                "commit_sha": "def456",
                "status": "completed",
                "comment_id": 100,
                "created_at": "2026-01-19T01:00:00Z",
                "completed_at": "2026-01-19T02:00:00Z",
            },
        ]
        # Mock count response
        mock_count_result = MagicMock()
        mock_count_result.count = 10
        mock_client.table.return_value.select.return_value.execute.return_value = mock_count_result

        repo = ReviewRepo(mock_client)
        result, total = repo.get_all_paginated(offset=0, limit=2)

        assert len(result) == 2
        assert result[0].pr_number == 42
        assert result[1].pr_number == 43
        assert total == 10

    def test_count_all(self):
        """Test counting all reviews."""
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.count = 25
        mock_client.table.return_value.select.return_value.execute.return_value = mock_result

        repo = ReviewRepo(mock_client)
        result = repo.count_all()

        assert result == 25


class TestReviewRepoStats:
    """Tests for ReviewRepo stats methods."""

    def test_count_by_status(self):
        """Test counting reviews by status."""
        mock_client = MagicMock()

        # Create mock results for each status query
        def mock_eq(column, status):
            mock_result = MagicMock()
            status_counts = {
                "pending": 5,
                "processing": 2,
                "completed": 10,
                "failed": 3,
            }
            mock_result.count = status_counts.get(status, 0)
            mock_chain = MagicMock()
            mock_chain.execute.return_value = mock_result
            return mock_chain

        mock_client.table.return_value.select.return_value.eq.side_effect = mock_eq

        repo = ReviewRepo(mock_client)
        result = repo.count_by_status()

        assert result == {
            "pending": 5,
            "processing": 2,
            "completed": 10,
            "failed": 3,
        }


class TestFindingRepo:
    """Tests for FindingRepo."""

    def test_create_finding(self):
        """Test creating a finding."""
        review_id = uuid4()
        finding_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": str(finding_id),
                "review_id": str(review_id),
                "agent_type": "security",
                "severity": "critical",
                "file_path": "main.py",
                "line_number": 42,
                "title": "SQL Injection",
                "description": "User input not sanitized",
                "suggestion": "Use parameterized queries",
                "created_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = FindingRepo(mock_client)
        result = repo.create(
            FindingCreate(
                review_id=review_id,
                agent_type=AgentType.SECURITY,
                severity=Severity.CRITICAL,
                file_path="main.py",
                line_number=42,
                title="SQL Injection",
                description="User input not sanitized",
                suggestion="Use parameterized queries",
            )
        )

        assert result.title == "SQL Injection"
        assert result.agent_type == AgentType.SECURITY
        assert result.severity == Severity.CRITICAL

    def test_create_many_findings(self):
        """Test creating multiple findings."""
        review_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "review_id": str(review_id),
                "agent_type": "security",
                "severity": "critical",
                "file_path": "main.py",
                "line_number": 42,
                "title": "SQL Injection",
                "description": "User input not sanitized",
                "suggestion": None,
                "created_at": "2026-01-19T00:00:00Z",
            },
            {
                "id": str(uuid4()),
                "review_id": str(review_id),
                "agent_type": "quality",
                "severity": "info",
                "file_path": "utils.py",
                "line_number": 10,
                "title": "Missing docstring",
                "description": "Function lacks documentation",
                "suggestion": "Add docstring",
                "created_at": "2026-01-19T00:00:00Z",
            },
        ]

        repo = FindingRepo(mock_client)
        findings = [
            FindingCreate(
                review_id=review_id,
                agent_type=AgentType.SECURITY,
                severity=Severity.CRITICAL,
                file_path="main.py",
                line_number=42,
                title="SQL Injection",
                description="User input not sanitized",
            ),
            FindingCreate(
                review_id=review_id,
                agent_type=AgentType.QUALITY,
                severity=Severity.INFO,
                file_path="utils.py",
                line_number=10,
                title="Missing docstring",
                description="Function lacks documentation",
                suggestion="Add docstring",
            ),
        ]
        result = repo.create_many(findings)

        assert len(result) == 2

    def test_create_many_empty_list(self):
        """Test creating findings with empty list."""
        mock_client = MagicMock()
        repo = FindingRepo(mock_client)
        result = repo.create_many([])

        assert result == []
        mock_client.table.assert_not_called()

    def test_get_by_review(self):
        """Test getting findings by review."""
        review_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "review_id": str(review_id),
                "agent_type": "security",
                "severity": "critical",
                "file_path": "main.py",
                "line_number": 42,
                "title": "SQL Injection",
                "description": "User input not sanitized",
                "suggestion": None,
                "created_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = FindingRepo(mock_client)
        result = repo.get_by_review(review_id)

        assert len(result) == 1
        assert result[0].title == "SQL Injection"


class TestSettingsRepo:
    """Tests for SettingsRepo."""

    def test_create_settings(self):
        """Test creating settings."""
        repo_id = uuid4()
        settings_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": str(settings_id),
                "repository_id": str(repo_id),
                "enabled": True,
                "agents_enabled": {"logic": True, "security": True, "quality": True},
                "severity_threshold": "info",
                "created_at": "2026-01-19T00:00:00Z",
                "updated_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = SettingsRepo(mock_client)
        result = repo.create(SettingsCreate(repository_id=repo_id))

        assert result.enabled is True
        assert result.agents_enabled.logic is True
        assert result.severity_threshold == Severity.INFO

    def test_get_by_repository(self):
        """Test getting settings by repository."""
        repo_id = uuid4()
        settings_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(settings_id),
                "repository_id": str(repo_id),
                "enabled": True,
                "agents_enabled": {"logic": True, "security": True, "quality": False},
                "severity_threshold": "medium",
                "created_at": "2026-01-19T00:00:00Z",
                "updated_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = SettingsRepo(mock_client)
        result = repo.get_by_repository(repo_id)

        assert result is not None
        assert result.agents_enabled.quality is False
        assert result.severity_threshold == Severity.MEDIUM

    def test_get_by_repository_not_found(self):
        """Test getting non-existent settings."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        repo = SettingsRepo(mock_client)
        result = repo.get_by_repository(uuid4())

        assert result is None

    def test_update_settings(self):
        """Test updating settings."""
        repo_id = uuid4()
        settings_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(settings_id),
                "repository_id": str(repo_id),
                "enabled": False,
                "agents_enabled": {"logic": True, "security": True, "quality": True},
                "severity_threshold": "critical",
                "created_at": "2026-01-19T00:00:00Z",
                "updated_at": "2026-01-19T01:00:00Z",
            }
        ]

        from app.models import SettingsUpdate
        repo = SettingsRepo(mock_client)
        result = repo.update(
            repo_id,
            SettingsUpdate(enabled=False, severity_threshold=Severity.CRITICAL),
        )

        assert result is not None
        assert result.enabled is False
        assert result.severity_threshold == Severity.CRITICAL

    def test_get_or_create_existing(self):
        """Test get_or_create with existing settings."""
        repo_id = uuid4()
        settings_id = uuid4()
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": str(settings_id),
                "repository_id": str(repo_id),
                "enabled": True,
                "agents_enabled": {"logic": True, "security": True, "quality": True},
                "severity_threshold": "info",
                "created_at": "2026-01-19T00:00:00Z",
                "updated_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = SettingsRepo(mock_client)
        result = repo.get_or_create(repo_id)

        assert result is not None
        assert result.id == settings_id
        # Insert should not be called since settings exist
        mock_client.table.return_value.insert.assert_not_called()

    def test_get_or_create_new(self):
        """Test get_or_create with new settings."""
        repo_id = uuid4()
        settings_id = uuid4()
        mock_client = MagicMock()
        # First call (get) returns empty
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        # Second call (create) returns new settings
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": str(settings_id),
                "repository_id": str(repo_id),
                "enabled": True,
                "agents_enabled": {"logic": True, "security": True, "quality": True},
                "severity_threshold": "info",
                "created_at": "2026-01-19T00:00:00Z",
                "updated_at": "2026-01-19T00:00:00Z",
            }
        ]

        repo = SettingsRepo(mock_client)
        result = repo.get_or_create(repo_id)

        assert result is not None
        assert result.id == settings_id
