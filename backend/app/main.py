"""CodeGuard AI - FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client

from app.config import settings
from app.db import get_db, FindingRepo, SettingsRepo
from app.services.github import GitHubService
from app.services.queue import get_redis_client, RateLimiter
from app.agents import ReviewSupervisor
from app.api import repositories_router, reviews_router, stats_router, webhook_router
from app.services.websocket import manager as ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    # Startup
    print(f"Starting CodeGuard AI in {settings.environment} mode")
    yield
    # Shutdown
    print("Shutting down CodeGuard AI")


app = FastAPI(
    title="CodeGuard AI",
    description="Multi-agent PR review system for GitHub pull requests",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(repositories_router)
app.include_router(reviews_router)
app.include_router(stats_router)
app.include_router(webhook_router)


# Dependency injection
def get_finding_repo(db: Annotated[Client, Depends(get_db)]) -> FindingRepo:
    """Get FindingRepo instance."""
    return FindingRepo(db)


def get_settings_repo(db: Annotated[Client, Depends(get_db)]) -> SettingsRepo:
    """Get SettingsRepo instance."""
    return SettingsRepo(db)


def get_rate_limiter() -> RateLimiter:
    """Get RateLimiter instance for Gemini API."""
    return RateLimiter(get_redis_client(), max_requests=15, window_seconds=60)


def get_github_service() -> GitHubService:
    """Get GitHubService instance."""
    return GitHubService()


def get_review_supervisor() -> ReviewSupervisor:
    """Get ReviewSupervisor instance for code review."""
    return ReviewSupervisor()


@app.websocket("/ws/reviews/{review_id}")
async def websocket_review_progress(websocket: WebSocket, review_id: str):
    """WebSocket endpoint for real-time review progress updates.

    Clients connect to this endpoint to receive progress updates for a
    specific review. Updates are broadcast from the worker as the review
    progresses through stages.
    """
    await ws_manager.connect(review_id, websocket)
    try:
        # Keep connection open until client disconnects
        while True:
            # Wait for messages (ping/pong keepalive)
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        ws_manager.disconnect(review_id, websocket)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "CodeGuard AI API",
        "docs": "/docs",
        "health": "/health",
    }
