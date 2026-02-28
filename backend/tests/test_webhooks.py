# backend/tests/test_webhooks.py
"""Tests for GitHub webhook handling."""

import hashlib
import hmac
import pytest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.api.webhooks import (
    verify_signature,
    WebhookPayload,
    get_repository_repo,
    get_review_repo,
)
from app.main import app


class TestSignatureVerification:
    """Tests for webhook signature verification."""

    def test_verify_valid_signature(self):
        """Test that valid signature passes verification."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'

        # Generate valid signature
        signature = "sha256=" + hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        result = verify_signature(payload, signature, secret)
        assert result is True

    def test_verify_invalid_signature(self):
        """Test that invalid signature fails verification."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'
        signature = "sha256=invalid"

        result = verify_signature(payload, signature, secret)
        assert result is False

    def test_verify_missing_prefix(self):
        """Test that signature without sha256= prefix fails."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'
        signature = "notavalidformat"

        result = verify_signature(payload, signature, secret)
        assert result is False


class TestWebhookPayload:
    """Tests for webhook payload parsing."""

    def test_parse_pr_opened_payload(self):
        """Test parsing pull_request.opened event."""
        data = {
            "action": "opened",
            "number": 42,
            "pull_request": {
                "title": "Add new feature",
                "head": {"sha": "abc123"},
            },
            "repository": {
                "id": 123456,
                "full_name": "owner/repo",
            },
        }

        payload = WebhookPayload(**data)

        assert payload.action == "opened"
        assert payload.number == 42
        assert payload.repository.full_name == "owner/repo"

    def test_parse_pr_synchronize_payload(self):
        """Test parsing pull_request.synchronize event."""
        data = {
            "action": "synchronize",
            "number": 42,
            "pull_request": {
                "title": "Add new feature",
                "head": {"sha": "def456"},
            },
            "repository": {
                "id": 123456,
                "full_name": "owner/repo",
            },
        }

        payload = WebhookPayload(**data)

        assert payload.action == "synchronize"
        assert payload.pull_request.head.sha == "def456"


class TestWebhookEndpoint:
    """Tests for webhook endpoint."""

    def setup_method(self):
        """Set up test client with mocked dependencies."""
        # Mock dependencies to avoid needing real DB/Redis
        self.mock_repo_repo = MagicMock()
        self.mock_review_repo = MagicMock()

        app.dependency_overrides[get_repository_repo] = lambda: self.mock_repo_repo
        app.dependency_overrides[get_review_repo] = lambda: self.mock_review_repo

        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def test_webhook_ignored_non_pr_event(self):
        """Test that non-PR events are ignored."""
        response = self.client.post(
            "/api/webhook/github",
            content=b'{"action": "created"}',
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "issues",
                "X-Hub-Signature-256": "sha256=whatever",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ignored"

    @patch("app.api.webhooks.settings")
    def test_webhook_invalid_signature(self, mock_settings):
        """Test that invalid signature returns 401."""
        mock_settings.github_webhook_secret = "test-secret"
        response = self.client.post(
            "/api/webhook/github",
            content=b'{"action": "opened"}',
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": "sha256=invalid",
            },
        )
        assert response.status_code == 401
