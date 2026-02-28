"""Tests for WebSocket connection manager."""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestConnectionManager:
    """Tests for ConnectionManager class."""

    def test_manager_initializes_empty(self):
        """Test that manager starts with no connections."""
        from app.services.websocket import ConnectionManager

        manager = ConnectionManager()
        assert manager.active_connections == {}

    @pytest.mark.asyncio
    async def test_connect_adds_websocket(self):
        """Test that connect adds websocket to review's connection list."""
        from app.services.websocket import ConnectionManager

        manager = ConnectionManager()
        mock_ws = AsyncMock()
        mock_ws.accept = AsyncMock()

        await manager.connect("review-123", mock_ws)

        assert "review-123" in manager.active_connections
        assert mock_ws in manager.active_connections["review-123"]
        mock_ws.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect_removes_websocket(self):
        """Test that disconnect removes websocket from list."""
        from app.services.websocket import ConnectionManager

        manager = ConnectionManager()
        mock_ws = AsyncMock()
        mock_ws.accept = AsyncMock()

        await manager.connect("review-123", mock_ws)
        manager.disconnect("review-123", mock_ws)

        assert mock_ws not in manager.active_connections.get("review-123", [])

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all_connections(self):
        """Test that broadcast sends data to all connected clients."""
        from app.services.websocket import ConnectionManager

        manager = ConnectionManager()
        mock_ws1 = AsyncMock()
        mock_ws1.accept = AsyncMock()
        mock_ws1.send_json = AsyncMock()
        mock_ws2 = AsyncMock()
        mock_ws2.accept = AsyncMock()
        mock_ws2.send_json = AsyncMock()

        await manager.connect("review-123", mock_ws1)
        await manager.connect("review-123", mock_ws2)

        await manager.broadcast("review-123", {"progress": 50})

        mock_ws1.send_json.assert_called_once_with({"progress": 50})
        mock_ws2.send_json.assert_called_once_with({"progress": 50})

    @pytest.mark.asyncio
    async def test_broadcast_handles_disconnected_client(self):
        """Test that broadcast handles clients that disconnect mid-broadcast."""
        from app.services.websocket import ConnectionManager

        manager = ConnectionManager()
        mock_ws = AsyncMock()
        mock_ws.accept = AsyncMock()
        mock_ws.send_json = AsyncMock(side_effect=Exception("Connection closed"))

        await manager.connect("review-123", mock_ws)

        # Should not raise
        await manager.broadcast("review-123", {"progress": 50})
