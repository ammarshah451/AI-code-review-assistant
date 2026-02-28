"""Redis queue service for job management and rate limiting."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from upstash_redis import Redis

from app.config import settings


def get_redis_client() -> Redis:
    """Get Upstash Redis client."""
    if not settings.upstash_redis_rest_url or not settings.upstash_redis_rest_token:
        raise ValueError("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set")

    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    )


class RateLimiter:
    """Rate limiter using Redis sliding window."""

    def __init__(
        self,
        redis: Redis,
        max_requests: int = 15,
        window_seconds: int = 60,
    ):
        self.redis = redis
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def can_proceed(self, key: str) -> bool:
        """Check if request can proceed under rate limit."""
        rate_key = f"rate_limit:{key}"
        current = self.redis.get(rate_key)

        if current is not None and int(current) >= self.max_requests:
            return False

        return True

    def increment(self, key: str) -> int:
        """Increment rate limit counter."""
        rate_key = f"rate_limit:{key}"
        count = self.redis.incr(rate_key)

        if count == 1:
            self.redis.expire(rate_key, self.window_seconds)

        return count

    def get_remaining(self, key: str) -> int:
        """Get remaining requests in current window."""
        rate_key = f"rate_limit:{key}"
        current = self.redis.get(rate_key)

        if current is None:
            return self.max_requests

        return max(0, self.max_requests - int(current))


class QueueService:
    """Redis-based job queue for review processing."""

    QUEUE_KEY = "codeguard:review_queue"
    JOB_STATUS_TTL = 3600  # 1 hour

    def __init__(self, redis: Redis):
        self.redis = redis

    def enqueue_review(
        self, job_id: str, data: Dict[str, Any], priority: int = 0
    ) -> None:
        """Add a review job to the queue."""
        job = {
            "job_id": job_id,
            "data": data,
            "priority": priority,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.redis.lpush(self.QUEUE_KEY, json.dumps(job))

    def dequeue_review(self) -> Optional[Dict[str, Any]]:
        """Get next review job from queue."""
        job_data = self.redis.rpop(self.QUEUE_KEY)

        if job_data is None:
            return None

        return json.loads(job_data)

    def queue_length(self) -> int:
        """Get current queue length."""
        return self.redis.llen(self.QUEUE_KEY)

    def set_job_status(
        self, job_id: str, status: str, result: Optional[Dict] = None
    ) -> None:
        """Set job status in Redis."""
        status_key = f"codeguard:job:{job_id}"
        status_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if result:
            status_data["result"] = result

        self.redis.set(status_key, json.dumps(status_data))
        self.redis.expire(status_key, self.JOB_STATUS_TTL)

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status from Redis."""
        status_key = f"codeguard:job:{job_id}"
        data = self.redis.get(status_key)

        if data is None:
            return None

        return json.loads(data)
