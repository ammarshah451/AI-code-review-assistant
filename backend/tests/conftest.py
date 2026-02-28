"""Pytest fixtures for CodeGuard AI tests."""

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client."""
    client = MagicMock()
    return client


@pytest.fixture
def mock_redis_client():
    """Mock Redis client."""
    client = MagicMock()
    client.get.return_value = None
    client.set.return_value = None
    client.incr.return_value = 1
    client.expire.return_value = None
    client.lpush.return_value = 1
    client.rpop.return_value = None
    client.llen.return_value = 0
    return client


@pytest.fixture
def mock_review_supervisor():
    """Mock ReviewSupervisor for testing."""
    supervisor = MagicMock()
    supervisor.run.return_value = {
        "pr_diff": "",
        "pr_files": [],
        "logic_findings": [],
        "security_findings": [],
        "quality_findings": [],
        "final_comment": "## CodeGuard AI Review\n\nNo issues found!",
    }
    return supervisor
