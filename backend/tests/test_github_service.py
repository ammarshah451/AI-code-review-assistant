"""Tests for GitHub service client."""

import pytest
from unittest.mock import MagicMock, patch

from app.services.github import GitHubService


class TestGitHubService:
    """Tests for GitHubService."""

    def test_init_with_token(self):
        """Test client initialization with token."""
        service = GitHubService(token="test-token")
        assert service.token == "test-token"
        assert "Authorization" in service.headers

    def test_get_pr_url(self):
        """Test PR API URL construction (relative paths for base_url client)."""
        service = GitHubService(token="test-token")
        url = service._get_pr_url("owner", "repo", 123)
        assert url == "/repos/owner/repo/pulls/123"

    def test_get_pr_diff(self):
        """Test fetching PR diff."""
        service = GitHubService(token="test-token")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "diff --git a/file.py b/file.py\n+new line"
        service._client = MagicMock()
        service._client.get.return_value = mock_response

        diff = service.get_pr_diff("owner", "repo", 123)

        assert "diff --git" in diff
        service._client.get.assert_called_once()

    def test_get_pr_files(self):
        """Test fetching PR files."""
        service = GitHubService(token="test-token")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"filename": "src/main.py", "status": "modified", "patch": "+code"},
            {"filename": "src/utils.py", "status": "added", "patch": "+new"},
        ]
        service._client = MagicMock()
        service._client.get.return_value = mock_response

        files = service.get_pr_files("owner", "repo", 123)

        assert len(files) == 2
        assert files[0]["filename"] == "src/main.py"

    def test_post_comment(self):
        """Test posting PR comment."""
        service = GitHubService(token="test-token")
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": 12345, "body": "Test comment"}
        service._client = MagicMock()
        service._client.post.return_value = mock_response

        comment = service.post_comment("owner", "repo", 123, "Test comment")

        assert comment["id"] == 12345
        service._client.post.assert_called_once()

    def test_update_comment(self):
        """Test updating PR comment."""
        service = GitHubService(token="test-token")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": 12345, "body": "Updated comment"}
        service._client = MagicMock()
        service._client.patch.return_value = mock_response

        comment = service.update_comment("owner", "repo", 12345, "Updated comment")

        assert comment["body"] == "Updated comment"
        service._client.patch.assert_called_once()

    def test_get_issues_url(self):
        """Test issues API URL construction (relative paths)."""
        service = GitHubService(token="test-token")
        url = service._get_issues_url("owner", "repo", 123)
        assert url == "/repos/owner/repo/issues/123"

    def test_get_comments_url(self):
        """Test comments API URL construction (relative paths)."""
        service = GitHubService(token="test-token")
        url = service._get_comments_url("owner", "repo")
        assert url == "/repos/owner/repo/issues/comments"

    def test_get_pr_info(self):
        """Test fetching PR info."""
        service = GitHubService(token="test-token")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "number": 123,
            "title": "Test PR",
            "state": "open",
        }
        service._client = MagicMock()
        service._client.get.return_value = mock_response

        info = service.get_pr_info("owner", "repo", 123)

        assert info["number"] == 123
        assert info["title"] == "Test PR"

    def test_delete_comment(self):
        """Test deleting comment."""
        service = GitHubService(token="test-token")
        mock_response = MagicMock()
        mock_response.status_code = 204
        service._client = MagicMock()
        service._client.delete.return_value = mock_response

        result = service.delete_comment("owner", "repo", 12345)

        assert result is True
        service._client.delete.assert_called_once()

    @patch("app.services.github.settings")
    def test_init_without_token_raises(self, mock_settings):
        """Test that missing token raises ValueError."""
        mock_settings.github_token = ""
        mock_settings.github_private_key = ""

        with pytest.raises(ValueError, match="GitHub token is required"):
            GitHubService()

    def test_close(self):
        """Test closing the HTTP client."""
        service = GitHubService(token="test-token")
        service._client = MagicMock()
        service.close()
        service._client.close.assert_called_once()

