"""Tests for the background worker processor."""

import pytest
from unittest.mock import MagicMock, patch, call
from uuid import UUID

from app.worker.processor import (
    process_review,
    map_agent_severity,
    map_agent_type,
    extract_files_from_diff,
    _map_finding,
)
from app.models.finding import AgentType, Severity
from app.models.review import ReviewStatus
from app.agents.schemas import AgentFinding


class TestMapAgentSeverity:
    """Tests for severity mapping function."""

    def test_map_critical(self):
        """Critical maps to CRITICAL."""
        assert map_agent_severity("critical") == Severity.CRITICAL

    def test_map_warning(self):
        """Warning maps to MEDIUM."""
        assert map_agent_severity("warning") == Severity.MEDIUM

    def test_map_info(self):
        """Info maps to INFO."""
        assert map_agent_severity("info") == Severity.INFO

    def test_map_unknown_defaults_to_info(self):
        """Unknown severity defaults to INFO."""
        assert map_agent_severity("unknown") == Severity.INFO


class TestMapAgentType:
    """Tests for agent type mapping function."""

    def test_map_logic(self):
        """Logic maps to LOGIC."""
        assert map_agent_type("logic") == AgentType.LOGIC

    def test_map_security(self):
        """Security maps to SECURITY."""
        assert map_agent_type("security") == AgentType.SECURITY

    def test_map_quality(self):
        """Quality maps to QUALITY."""
        assert map_agent_type("quality") == AgentType.QUALITY

    def test_map_unknown_defaults_to_logic(self):
        """Unknown agent type defaults to LOGIC."""
        assert map_agent_type("unknown") == AgentType.LOGIC


class TestExtractFilesFromDiff:
    """Tests for diff parsing function."""

    def test_extract_single_file(self):
        """Extract single file from diff."""
        diff = "diff --git a/app.py b/app.py\n--- a/app.py\n+++ b/app.py"
        files = extract_files_from_diff(diff)
        assert files == ["app.py"]

    def test_extract_multiple_files(self):
        """Extract multiple files from diff."""
        diff = """diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
@@ -1,3 +1,4 @@
+import os
diff --git a/utils/helper.py b/utils/helper.py
--- a/utils/helper.py
+++ b/utils/helper.py
@@ -10,5 +10,6 @@
+def new_func():
"""
        files = extract_files_from_diff(diff)
        assert files == ["app.py", "utils/helper.py"]

    def test_extract_empty_diff(self):
        """Empty diff returns empty list."""
        files = extract_files_from_diff("")
        assert files == []

    def test_extract_no_files(self):
        """Non-diff text returns empty list."""
        files = extract_files_from_diff("Some random text\nwithout diff markers")
        assert files == []


class TestMapFinding:
    """Tests for finding mapping function."""

    def test_map_finding_all_fields(self):
        """Map finding with all fields."""
        agent_finding = AgentFinding(
            severity="critical",
            file_path="app.py",
            line_number=42,
            title="SQL Injection",
            description="User input in query",
            suggestion="Use parameterized queries",
        )

        result = _map_finding(agent_finding, "550e8400-e29b-41d4-a716-446655440000", "security")

        assert result.review_id == UUID("550e8400-e29b-41d4-a716-446655440000")
        assert result.agent_type == AgentType.SECURITY
        assert result.severity == Severity.CRITICAL
        assert result.file_path == "app.py"
        assert result.line_number == 42
        assert result.title == "SQL Injection"
        assert result.description == "User input in query"
        assert result.suggestion == "Use parameterized queries"

    def test_map_finding_optional_fields(self):
        """Map finding with optional fields as None."""
        agent_finding = AgentFinding(
            severity="info",
            file_path="test.py",
            title="Minor issue",
            description="Description",
        )

        result = _map_finding(agent_finding, "550e8400-e29b-41d4-a716-446655440000", "quality")

        assert result.line_number is None
        assert result.suggestion is None


class TestProcessReview:
    """Tests for the main process_review function."""

    @patch("app.worker.processor.SettingsRepo")
    @patch("app.worker.processor.RateLimiter")
    @patch("app.worker.processor.get_redis_client")
    @patch("app.worker.processor.GitHubService")
    @patch("app.worker.processor.ReviewSupervisor")
    @patch("app.worker.processor.FindingRepo")
    @patch("app.worker.processor.ReviewRepo")
    @patch("app.worker.processor.get_db")
    def test_process_review_success(
        self,
        mock_get_db,
        mock_review_repo_class,
        mock_finding_repo_class,
        mock_supervisor_class,
        mock_github_class,
        mock_get_redis,
        mock_rate_limiter_class,
        mock_settings_repo_class,
    ):
        """Test successful review processing."""
        # Setup mocks
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_review_repo = MagicMock()
        # get_by_id must return a review object with repository_id for settings lookup
        mock_review = MagicMock()
        mock_review.repository_id = "repo-uuid"
        mock_review_repo.get_by_id.return_value = mock_review
        mock_review_repo_class.return_value = mock_review_repo

        mock_finding_repo = MagicMock()
        mock_finding_repo_class.return_value = mock_finding_repo

        # Settings: no settings → defaults (all agents enabled)
        mock_settings_repo = MagicMock()
        mock_settings_repo.get_by_repository.return_value = None
        mock_settings_repo_class.return_value = mock_settings_repo

        mock_github = MagicMock()
        mock_github.get_pr_diff.return_value = "diff --git a/app.py b/app.py\n+code"
        mock_github.post_comment.return_value = {"id": 12345}
        mock_github_class.return_value = mock_github

        mock_supervisor = MagicMock()
        mock_supervisor.run.return_value = {
            "logic_findings": [],
            "security_findings": [
                AgentFinding(
                    severity="critical",
                    file_path="app.py",
                    title="Issue",
                    description="Desc",
                )
            ],
            "quality_findings": [],
            "final_comment": "## Review Comment",
        }
        mock_supervisor_class.return_value = mock_supervisor

        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis

        mock_rate_limiter = MagicMock()
        mock_rate_limiter.can_proceed.return_value = True
        mock_rate_limiter_class.return_value = mock_rate_limiter

        # Job data
        job_data = {
            "review_id": "550e8400-e29b-41d4-a716-446655440000",
            "owner": "testuser",
            "repo": "testrepo",
            "pr_number": 1,
            "commit_sha": "abc123",
        }

        # Run
        process_review(job_data)

        # Verify GitHub was called
        mock_github.get_pr_diff.assert_called_once_with("testuser", "testrepo", 1)
        mock_github.post_comment.assert_called_once()

        # Verify supervisor was run
        mock_supervisor.run.assert_called_once()

        # Verify findings were saved
        mock_finding_repo.create_many.assert_called_once()

        # Verify status updates
        assert mock_review_repo.update_status.call_count == 2  # processing, then completed

    @patch("app.worker.processor.SettingsRepo")
    @patch("app.worker.processor.RateLimiter")
    @patch("app.worker.processor.get_redis_client")
    @patch("app.worker.processor.GitHubService")
    @patch("app.worker.processor.FindingRepo")
    @patch("app.worker.processor.ReviewRepo")
    @patch("app.worker.processor.get_db")
    def test_process_review_github_error_sets_failed_status(
        self,
        mock_get_db,
        mock_review_repo_class,
        mock_finding_repo_class,
        mock_github_class,
        mock_get_redis,
        mock_rate_limiter_class,
        mock_settings_repo_class,
    ):
        """Test that GitHub errors result in failed status."""
        # Setup mocks
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_review_repo = MagicMock()
        mock_review = MagicMock()
        mock_review.repository_id = "repo-uuid"
        mock_review_repo.get_by_id.return_value = mock_review
        mock_review_repo_class.return_value = mock_review_repo

        mock_finding_repo = MagicMock()
        mock_finding_repo_class.return_value = mock_finding_repo

        mock_settings_repo = MagicMock()
        mock_settings_repo.get_by_repository.return_value = None
        mock_settings_repo_class.return_value = mock_settings_repo

        mock_github = MagicMock()
        mock_github.get_pr_diff.side_effect = Exception("GitHub API error")
        mock_github_class.return_value = mock_github

        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis

        mock_rate_limiter = MagicMock()
        mock_rate_limiter_class.return_value = mock_rate_limiter

        job_data = {
            "review_id": "550e8400-e29b-41d4-a716-446655440000",
            "owner": "testuser",
            "repo": "testrepo",
            "pr_number": 1,
            "commit_sha": "abc123",
        }

        # Run - should not raise
        process_review(job_data)

        # Verify status was set to failed
        # Last call should be with FAILED status
        last_call = mock_review_repo.update_status.call_args_list[-1]
        assert last_call[0][1] == ReviewStatus.FAILED

    @patch("app.worker.processor.SettingsRepo")
    @patch("app.worker.processor.RateLimiter")
    @patch("app.worker.processor.get_redis_client")
    @patch("app.worker.processor.GitHubService")
    @patch("app.worker.processor.ReviewSupervisor")
    @patch("app.worker.processor.FindingRepo")
    @patch("app.worker.processor.ReviewRepo")
    @patch("app.worker.processor.get_db")
    def test_process_review_agent_error_sets_failed_status(
        self,
        mock_get_db,
        mock_review_repo_class,
        mock_finding_repo_class,
        mock_supervisor_class,
        mock_github_class,
        mock_get_redis,
        mock_rate_limiter_class,
        mock_settings_repo_class,
    ):
        """Test that agent errors result in failed status."""
        # Setup mocks
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_review_repo = MagicMock()
        mock_review = MagicMock()
        mock_review.repository_id = "repo-uuid"
        mock_review_repo.get_by_id.return_value = mock_review
        mock_review_repo_class.return_value = mock_review_repo

        mock_finding_repo = MagicMock()
        mock_finding_repo_class.return_value = mock_finding_repo

        mock_settings_repo = MagicMock()
        mock_settings_repo.get_by_repository.return_value = None
        mock_settings_repo_class.return_value = mock_settings_repo

        mock_github = MagicMock()
        mock_github.get_pr_diff.return_value = "diff --git a/app.py b/app.py"
        mock_github_class.return_value = mock_github

        mock_supervisor = MagicMock()
        mock_supervisor.run.side_effect = Exception("LLM error")
        mock_supervisor_class.return_value = mock_supervisor

        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis

        mock_rate_limiter = MagicMock()
        mock_rate_limiter.can_proceed.return_value = True
        mock_rate_limiter_class.return_value = mock_rate_limiter

        job_data = {
            "review_id": "550e8400-e29b-41d4-a716-446655440000",
            "owner": "testuser",
            "repo": "testrepo",
            "pr_number": 1,
            "commit_sha": "abc123",
        }

        # Run - should not raise
        process_review(job_data)

        # Verify status was set to failed
        last_call = mock_review_repo.update_status.call_args_list[-1]
        assert last_call[0][1] == ReviewStatus.FAILED

    @patch("app.worker.processor.time.sleep")
    @patch("app.worker.processor.SettingsRepo")
    @patch("app.worker.processor.RateLimiter")
    @patch("app.worker.processor.get_redis_client")
    @patch("app.worker.processor.GitHubService")
    @patch("app.worker.processor.ReviewSupervisor")
    @patch("app.worker.processor.FindingRepo")
    @patch("app.worker.processor.ReviewRepo")
    @patch("app.worker.processor.get_db")
    def test_process_review_rate_limited_retries(
        self,
        mock_get_db,
        mock_review_repo_class,
        mock_finding_repo_class,
        mock_supervisor_class,
        mock_github_class,
        mock_get_redis,
        mock_rate_limiter_class,
        mock_settings_repo_class,
        mock_sleep,
    ):
        """Test that rate limiting triggers retries."""
        # Setup mocks
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_review_repo = MagicMock()
        mock_review = MagicMock()
        mock_review.repository_id = "repo-uuid"
        mock_review_repo.get_by_id.return_value = mock_review
        mock_review_repo_class.return_value = mock_review_repo

        mock_finding_repo = MagicMock()
        mock_finding_repo_class.return_value = mock_finding_repo

        mock_settings_repo = MagicMock()
        mock_settings_repo.get_by_repository.return_value = None
        mock_settings_repo_class.return_value = mock_settings_repo

        mock_github = MagicMock()
        mock_github.get_pr_diff.return_value = "diff --git a/app.py b/app.py"
        mock_github.post_comment.return_value = {"id": 123}
        mock_github_class.return_value = mock_github

        mock_supervisor = MagicMock()
        mock_supervisor.run.return_value = {
            "logic_findings": [],
            "security_findings": [],
            "quality_findings": [],
            "final_comment": "Comment",
        }
        mock_supervisor_class.return_value = mock_supervisor

        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis

        # Rate limiter returns False twice, then True
        mock_rate_limiter = MagicMock()
        mock_rate_limiter.can_proceed.side_effect = [False, False, True]
        mock_rate_limiter_class.return_value = mock_rate_limiter

        job_data = {
            "review_id": "550e8400-e29b-41d4-a716-446655440000",
            "owner": "testuser",
            "repo": "testrepo",
            "pr_number": 1,
            "commit_sha": "abc123",
        }

        # Run
        process_review(job_data)

        # Verify sleep was called for retry delays
        assert mock_sleep.call_count == 2  # Two retries before success
