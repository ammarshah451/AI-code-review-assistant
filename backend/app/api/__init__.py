# backend/app/api/__init__.py
"""API routers for CodeGuard AI."""

from app.api.repositories import router as repositories_router
from app.api.reviews import router as reviews_router
from app.api.stats import router as stats_router
from app.api.webhooks import router as webhook_router

__all__ = ["repositories_router", "reviews_router", "stats_router", "webhook_router"]
