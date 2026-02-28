"""GitHub API client for PR operations."""

from typing import Any, Dict, List, Optional

import httpx

from app.config import settings


class GitHubService:
    """GitHub API client for fetching PR data and posting comments.

    Uses a persistent httpx.Client for connection reuse and pooling.
    """

    BASE_URL = "https://api.github.com"
    ACCEPT_JSON = "application/vnd.github.v3+json"
    ACCEPT_DIFF = "application/vnd.github.v3.diff"

    def __init__(self, token: Optional[str] = None):
        """Initialize GitHub client with authentication token."""
        self.token = token or settings.github_token or settings.github_private_key
        if not self.token:
            raise ValueError("GitHub token is required")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": self.ACCEPT_JSON,
            "X-GitHub-Api-Version": "2022-11-28",
        }
        # Persistent client with connection pooling
        self._client = httpx.Client(
            base_url=self.BASE_URL,
            headers=self.headers,
            timeout=30.0,
        )

    def _get_pr_url(self, owner: str, repo: str, pr_number: int) -> str:
        """Construct PR API URL."""
        return f"/repos/{owner}/{repo}/pulls/{pr_number}"

    def _get_issues_url(self, owner: str, repo: str, pr_number: int) -> str:
        """Construct issues API URL (for comments)."""
        return f"/repos/{owner}/{repo}/issues/{pr_number}"

    def _get_comments_url(self, owner: str, repo: str) -> str:
        """Construct issue comments API URL."""
        return f"/repos/{owner}/{repo}/issues/comments"

    def get_pr_diff(self, owner: str, repo: str, pr_number: int) -> str:
        """Fetch PR diff as unified diff text."""
        url = self._get_pr_url(owner, repo, pr_number)
        response = self._client.get(
            url, headers={"Accept": self.ACCEPT_DIFF}
        )
        response.raise_for_status()
        return response.text

    def get_pr_files(self, owner: str, repo: str, pr_number: int) -> List[Dict[str, Any]]:
        """Fetch list of files changed in PR."""
        url = f"{self._get_pr_url(owner, repo, pr_number)}/files"
        response = self._client.get(url)
        response.raise_for_status()
        return response.json()

    def get_pr_info(self, owner: str, repo: str, pr_number: int) -> Dict[str, Any]:
        """Fetch PR metadata."""
        url = self._get_pr_url(owner, repo, pr_number)
        response = self._client.get(url)
        response.raise_for_status()
        return response.json()

    def post_comment(self, owner: str, repo: str, pr_number: int, body: str) -> Dict[str, Any]:
        """Post a comment on a PR."""
        url = f"{self._get_issues_url(owner, repo, pr_number)}/comments"
        response = self._client.post(url, json={"body": body})
        response.raise_for_status()
        return response.json()

    def update_comment(self, owner: str, repo: str, comment_id: int, body: str) -> Dict[str, Any]:
        """Update an existing comment."""
        url = f"{self._get_comments_url(owner, repo)}/{comment_id}"
        response = self._client.patch(url, json={"body": body})
        response.raise_for_status()
        return response.json()

    def delete_comment(self, owner: str, repo: str, comment_id: int) -> bool:
        """Delete a comment."""
        url = f"{self._get_comments_url(owner, repo)}/{comment_id}"
        response = self._client.delete(url)
        return response.status_code == 204

    def get_file_content(self, owner: str, repo: str, path: str, ref: str = "main") -> Optional[str]:
        """Fetch raw file content from repository.

        Args:
            owner: Repository owner
            repo: Repository name
            path: File path within the repository
            ref: Git ref (branch, tag, or commit SHA)

        Returns:
            File content as string, or None if file not found
        """
        url = f"/repos/{owner}/{repo}/contents/{path}"
        try:
            response = self._client.get(
                url,
                params={"ref": ref},
                headers={"Accept": "application/vnd.github.v3.raw"},
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError:
            return None

    def close(self):
        """Close the underlying HTTP client."""
        self._client.close()

