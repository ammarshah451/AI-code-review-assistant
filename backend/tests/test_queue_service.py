"""Tests for Redis queue service."""

import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.queue import QueueService, RateLimiter


class TestRateLimiter:
    """Tests for rate limiter."""

    def test_can_proceed_under_limit(self):
        """Test that requests under limit are allowed."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        mock_redis.incr.return_value = 1

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.can_proceed("gemini")

        assert result is True

    def test_cannot_proceed_at_limit(self):
        """Test that requests at limit are blocked."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = "15"

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.can_proceed("gemini")

        assert result is False

    def test_increment_first_request(self):
        """Test incrementing counter on first request sets expiry."""
        mock_redis = MagicMock()
        mock_redis.incr.return_value = 1

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.increment("gemini")

        assert result == 1
        mock_redis.expire.assert_called_once_with("rate_limit:gemini", 60)

    def test_increment_subsequent_request(self):
        """Test incrementing counter on subsequent request does not set expiry."""
        mock_redis = MagicMock()
        mock_redis.incr.return_value = 5

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.increment("gemini")

        assert result == 5
        mock_redis.expire.assert_not_called()

    def test_get_remaining_no_requests(self):
        """Test getting remaining when no requests made."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.get_remaining("gemini")

        assert result == 15

    def test_get_remaining_some_requests(self):
        """Test getting remaining when some requests made."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = "10"

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.get_remaining("gemini")

        assert result == 5

    def test_get_remaining_at_limit(self):
        """Test getting remaining when at limit."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = "15"

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.get_remaining("gemini")

        assert result == 0

    def test_get_remaining_over_limit(self):
        """Test getting remaining when somehow over limit returns 0."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = "20"

        limiter = RateLimiter(mock_redis, max_requests=15, window_seconds=60)
        result = limiter.get_remaining("gemini")

        assert result == 0


class TestQueueService:
    """Tests for queue service."""

    def test_enqueue_review(self):
        """Test enqueueing a review job."""
        mock_redis = MagicMock()
        mock_redis.lpush.return_value = 1

        queue = QueueService(mock_redis)
        job_id = str(uuid4())
        queue.enqueue_review(job_id, {"pr_number": 1})

        mock_redis.lpush.assert_called_once()

    def test_dequeue_review(self):
        """Test dequeueing a review job."""
        mock_redis = MagicMock()
        job_data = '{"job_id": "123", "data": {"pr_number": 1}}'
        mock_redis.rpop.return_value = job_data

        queue = QueueService(mock_redis)
        result = queue.dequeue_review()

        assert result is not None
        assert result["data"]["pr_number"] == 1

    def test_dequeue_review_empty_queue(self):
        """Test dequeueing from empty queue returns None."""
        mock_redis = MagicMock()
        mock_redis.rpop.return_value = None

        queue = QueueService(mock_redis)
        result = queue.dequeue_review()

        assert result is None

    def test_queue_length(self):
        """Test getting queue length."""
        mock_redis = MagicMock()
        mock_redis.llen.return_value = 5

        queue = QueueService(mock_redis)
        result = queue.queue_length()

        assert result == 5
        mock_redis.llen.assert_called_once_with("codeguard:review_queue")

    def test_set_job_status(self):
        """Test setting job status."""
        mock_redis = MagicMock()

        queue = QueueService(mock_redis)
        queue.set_job_status("job-123", "processing")

        mock_redis.set.assert_called_once()
        mock_redis.expire.assert_called_once_with("codeguard:job:job-123", 3600)

    def test_set_job_status_with_result(self):
        """Test setting job status with result."""
        mock_redis = MagicMock()

        queue = QueueService(mock_redis)
        queue.set_job_status(
            "job-123",
            "completed",
            result={"findings": 3}
        )

        # Verify set was called with result included
        call_args = mock_redis.set.call_args
        import json
        status_data = json.loads(call_args[0][1])
        assert status_data["status"] == "completed"
        assert status_data["result"]["findings"] == 3

    def test_get_job_status(self):
        """Test getting job status."""
        mock_redis = MagicMock()
        status_data = '{"status": "completed", "updated_at": "2026-01-19T00:00:00"}'
        mock_redis.get.return_value = status_data

        queue = QueueService(mock_redis)
        result = queue.get_job_status("job-123")

        assert result is not None
        assert result["status"] == "completed"
        mock_redis.get.assert_called_once_with("codeguard:job:job-123")

    def test_get_job_status_not_found(self):
        """Test getting non-existent job status."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None

        queue = QueueService(mock_redis)
        result = queue.get_job_status("nonexistent")

        assert result is None
