"""WebSocket connection manager for real-time progress updates."""

import asyncio
from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for review progress updates.

    This is a singleton that tracks active WebSocket connections per review_id,
    allowing the worker to broadcast progress updates to all connected clients.
    """

    def __init__(self):
        """Initialize empty connection store."""
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, review_id: str, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection.

        Args:
            review_id: The review ID this connection is watching
            websocket: The WebSocket connection to add
        """
        await websocket.accept()
        async with self._lock:
            if review_id not in self.active_connections:
                self.active_connections[review_id] = []
            self.active_connections[review_id].append(websocket)

    def disconnect(self, review_id: str, websocket: WebSocket) -> None:
        """Remove a WebSocket connection.

        Args:
            review_id: The review ID this connection was watching
            websocket: The WebSocket connection to remove
        """
        if review_id in self.active_connections:
            if websocket in self.active_connections[review_id]:
                self.active_connections[review_id].remove(websocket)
            if not self.active_connections[review_id]:
                del self.active_connections[review_id]

    async def broadcast(self, review_id: str, data: dict) -> None:
        """Send data to all connections watching a review.

        Args:
            review_id: The review ID to broadcast to
            data: JSON-serializable data to send
        """
        if review_id not in self.active_connections:
            return

        disconnected = []
        for websocket in self.active_connections[review_id]:
            try:
                await websocket.send_json(data)
            except Exception:
                disconnected.append(websocket)

        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(review_id, ws)


# Singleton instance
manager = ConnectionManager()
