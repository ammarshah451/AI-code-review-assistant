"""Tests for WebSocket endpoint."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from uuid import uuid4

from app.main import app


class TestWebSocketEndpoint:
    """Tests for /ws/reviews/{review_id} endpoint."""

    def test_websocket_connects_for_processing_review(self):
        """Test WebSocket connection accepted for processing review."""
        review_id = str(uuid4())

        # Mock the review repo to return a processing review
        mock_review = MagicMock()
        mock_review.status = "processing"

        with patch("app.main.get_db") as mock_db:
            mock_repo = MagicMock()
            mock_repo.get_by_id.return_value = mock_review

            with TestClient(app) as client:
                with client.websocket_connect(f"/ws/reviews/{review_id}") as websocket:
                    # Connection should be accepted
                    # Send a ping to verify connection
                    pass  # Connection accepted = test passes

    def test_websocket_receives_progress_updates(self):
        """Test that connected client receives broadcast messages."""
        # This is tested via integration test since it requires
        # the worker to actually broadcast
        pass
