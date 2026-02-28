"""Tests for false positive marking."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.main import app
from app.api.reviews import get_finding_repo
from app.models import Finding, AgentType, Severity


class TestFalsePositiveEndpoint:
    """Tests for PUT /api/findings/{id}/false-positive."""

    def setup_method(self):
        self.client = TestClient(app)

    def test_mark_false_positive(self):
        """Test marking a finding as false positive."""
        finding_id = uuid4()

        mock_finding = Finding(
            id=finding_id,
            review_id=uuid4(),
            agent_type=AgentType.LOGIC,
            severity=Severity.MEDIUM,
            file_path="test.py",
            title="Test Finding",
            description="Test description",
            is_false_positive=True,
            false_positive_reason="Test code",
            created_at="2026-02-04T00:00:00Z",
        )

        mock_repo = MagicMock()
        mock_repo.mark_false_positive.return_value = mock_finding

        app.dependency_overrides[get_finding_repo] = lambda: mock_repo

        try:
            response = self.client.put(
                f"/api/findings/{finding_id}/false-positive",
                json={"is_false_positive": True, "reason": "Test code"},
            )

            assert response.status_code == 200
            mock_repo.mark_false_positive.assert_called_once()
        finally:
            app.dependency_overrides.clear()

    def test_unmark_false_positive(self):
        """Test unmarking a finding as false positive."""
        finding_id = uuid4()

        mock_finding = Finding(
            id=finding_id,
            review_id=uuid4(),
            agent_type=AgentType.LOGIC,
            severity=Severity.MEDIUM,
            file_path="test.py",
            title="Test Finding",
            description="Test description",
            is_false_positive=False,
            false_positive_reason=None,
            created_at="2026-02-04T00:00:00Z",
        )

        mock_repo = MagicMock()
        mock_repo.mark_false_positive.return_value = mock_finding

        app.dependency_overrides[get_finding_repo] = lambda: mock_repo

        try:
            response = self.client.put(
                f"/api/findings/{finding_id}/false-positive",
                json={"is_false_positive": False},
            )

            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()

    def test_false_positive_finding_not_found(self):
        """Test 404 when finding not found."""
        finding_id = uuid4()

        mock_repo = MagicMock()
        mock_repo.mark_false_positive.return_value = None

        app.dependency_overrides[get_finding_repo] = lambda: mock_repo

        try:
            response = self.client.put(
                f"/api/findings/{finding_id}/false-positive",
                json={"is_false_positive": True},
            )

            assert response.status_code == 404
        finally:
            app.dependency_overrides.clear()
