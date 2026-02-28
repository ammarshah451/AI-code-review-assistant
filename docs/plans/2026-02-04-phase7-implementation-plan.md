# Phase 7: UI/UX Improvements, WebSocket Progress, Agent Quality & Workflow Enhancements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time WebSocket progress tracking, a Critique Agent for better finding quality, UI/UX improvements (toast notifications, activity feed, grouped findings), and workflow features (confidence scores, false positive marking).

**Architecture:** WebSocket connections managed by a singleton ConnectionManager that broadcasts progress updates from the worker. Critique Agent runs after the three main agents to deduplicate, fix misattributions, and add confidence scores. Frontend uses custom hooks for WebSocket state and displays progress in a sticky top bar.

**Tech Stack:** FastAPI WebSockets, React hooks, Framer Motion animations, Tailwind CSS

---

## Pre-Implementation: Database Migration

Before starting, run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Reviews table: Add progress tracking
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS current_stage text;

-- Findings table: Add confidence and false positive fields
ALTER TABLE findings ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'medium';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS is_false_positive boolean DEFAULT false;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS false_positive_reason text;
```

---

## Task 1: WebSocket Connection Manager

**Files:**
- Create: `backend/app/services/websocket.py`
- Create: `backend/tests/test_websocket.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_websocket.py
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
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_websocket.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.services.websocket'"

**Step 3: Write the implementation**

```python
# backend/app/services/websocket.py
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
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_websocket.py -v`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add backend/app/services/websocket.py backend/tests/test_websocket.py
git commit -m "feat: add WebSocket connection manager for progress tracking"
```

---

## Task 2: WebSocket Endpoint

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_websocket_endpoint.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_websocket_endpoint.py
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
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_websocket_endpoint.py -v`
Expected: FAIL with connection refused (no endpoint exists)

**Step 3: Add WebSocket endpoint to main.py**

```python
# Add to backend/app/main.py after the router includes

from fastapi import WebSocket, WebSocketDisconnect
from app.services.websocket import manager as ws_manager
from app.db.repositories import ReviewRepo

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
```

**Step 4: Update imports at top of main.py**

Add to existing imports:
```python
from fastapi import WebSocket, WebSocketDisconnect
from app.services.websocket import manager as ws_manager
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_websocket_endpoint.py::TestWebSocketEndpoint::test_websocket_connects_for_processing_review -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_websocket_endpoint.py
git commit -m "feat: add WebSocket endpoint for review progress"
```

---

## Task 3: Update Agent Schemas with Confidence

**Files:**
- Modify: `backend/app/agents/schemas.py`
- Modify: `backend/tests/test_agent_schemas.py`

**Step 1: Write the failing test**

```python
# Add to backend/tests/test_agent_schemas.py

def test_agent_finding_has_confidence_field():
    """Test AgentFinding includes confidence field."""
    from app.agents.schemas import AgentFinding

    finding = AgentFinding(
        severity="warning",
        confidence="high",
        file_path="test.py",
        title="Test Issue",
        description="Test description",
    )
    assert finding.confidence == "high"


def test_agent_finding_confidence_defaults_to_medium():
    """Test AgentFinding confidence defaults to medium."""
    from app.agents.schemas import AgentFinding

    finding = AgentFinding(
        severity="warning",
        file_path="test.py",
        title="Test Issue",
        description="Test description",
    )
    assert finding.confidence == "medium"


def test_critique_response_schema():
    """Test CritiqueResponse schema."""
    from app.agents.schemas import CritiqueResponse, AgentFinding

    finding = AgentFinding(
        severity="warning",
        file_path="test.py",
        title="Test",
        description="Test",
    )

    response = CritiqueResponse(
        logic_findings=[finding],
        security_findings=[],
        quality_findings=[],
        duplicates_removed=2,
        misattributions_fixed=1,
        summary="Cleaned findings",
    )

    assert len(response.logic_findings) == 1
    assert response.duplicates_removed == 2
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_agent_schemas.py -v -k "confidence or critique"`
Expected: FAIL (fields don't exist)

**Step 3: Update schemas.py**

```python
# backend/app/agents/schemas.py
"""Agent schemas for CodeGuard AI multi-agent system."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field
from typing_extensions import TypedDict


class AgentFinding(BaseModel):
    """A finding reported by an agent during code review."""

    severity: Literal["critical", "warning", "info"] = Field(
        description="Severity level of the finding: critical, warning, or info"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        default="medium",
        description="Confidence level: high (clear issue), medium (likely issue), low (possible issue)"
    )
    file_path: str = Field(description="Path to the file containing the issue")
    line_number: Optional[int] = Field(
        default=None, description="Line number where the issue was found"
    )
    title: str = Field(description="Brief title describing the finding")
    description: str = Field(description="Detailed description of the finding")
    suggestion: Optional[str] = Field(
        default=None, description="Suggested fix for the issue"
    )


class AgentResponse(BaseModel):
    """Response from an agent containing findings and summary."""

    findings: List[AgentFinding] = Field(
        default_factory=list,
        description="List of findings from the agent. Return empty list if no issues found.",
    )
    summary: str = Field(description="Summary of the agent's analysis")


class CritiqueResponse(BaseModel):
    """Response from the Critique Agent with cleaned findings."""

    logic_findings: List[AgentFinding] = Field(
        default_factory=list,
        description="Cleaned logic findings"
    )
    security_findings: List[AgentFinding] = Field(
        default_factory=list,
        description="Cleaned security findings"
    )
    quality_findings: List[AgentFinding] = Field(
        default_factory=list,
        description="Cleaned quality findings"
    )
    duplicates_removed: int = Field(
        default=0,
        description="Number of duplicate findings removed"
    )
    misattributions_fixed: int = Field(
        default=0,
        description="Number of findings moved to correct category"
    )
    summary: str = Field(
        default="",
        description="Summary of critique analysis"
    )


class ReviewState(TypedDict):
    """LangGraph state for the code review workflow."""

    pr_diff: str
    pr_files: List[str]
    logic_findings: List[AgentFinding]
    security_findings: List[AgentFinding]
    quality_findings: List[AgentFinding]
    final_comment: str
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_agent_schemas.py -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add backend/app/agents/schemas.py backend/tests/test_agent_schemas.py
git commit -m "feat: add confidence field and CritiqueResponse schema"
```

---

## Task 4: Critique Agent Implementation

**Files:**
- Create: `backend/app/agents/critique.py`
- Modify: `backend/app/agents/prompts.py`
- Create: `backend/tests/test_critique_agent.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_critique_agent.py
"""Tests for Critique Agent."""

import pytest
from unittest.mock import MagicMock, patch

from app.agents.schemas import AgentFinding


class TestCritiqueAgent:
    """Tests for CritiqueAgent class."""

    def test_critique_agent_initializes(self):
        """Test CritiqueAgent initializes correctly."""
        from app.agents.critique import CritiqueAgent

        with patch("app.agents.critique.LLMService"):
            agent = CritiqueAgent()
            assert agent is not None

    def test_critique_removes_duplicates(self):
        """Test that critique identifies duplicate findings."""
        from app.agents.critique import CritiqueAgent

        # Create duplicate findings
        finding1 = AgentFinding(
            severity="critical",
            file_path="auth.py",
            title="SQL Injection",
            description="User input in query",
        )
        finding2 = AgentFinding(
            severity="warning",
            file_path="auth.py",
            title="SQL Injection vulnerability",
            description="Unsanitized input in SQL",
        )

        # Mock LLM to return deduplicated results
        mock_response = MagicMock()
        mock_response.logic_findings = []
        mock_response.security_findings = [finding1]  # Keep only one
        mock_response.quality_findings = []
        mock_response.duplicates_removed = 1
        mock_response.misattributions_fixed = 0

        with patch("app.agents.critique.LLMService") as MockLLM:
            mock_llm = MagicMock()
            mock_llm.invoke_structured.return_value = mock_response
            MockLLM.return_value = mock_llm

            agent = CritiqueAgent()
            result = agent.critique(
                logic_findings=[],
                security_findings=[finding1, finding2],
                quality_findings=[],
            )

            assert result.duplicates_removed == 1
            assert len(result.security_findings) == 1

    def test_critique_adds_confidence_scores(self):
        """Test that critique adds confidence to findings."""
        from app.agents.critique import CritiqueAgent

        finding = AgentFinding(
            severity="critical",
            file_path="auth.py",
            title="Hardcoded Password",
            description="Password in source code",
        )

        finding_with_confidence = AgentFinding(
            severity="critical",
            confidence="high",
            file_path="auth.py",
            title="Hardcoded Password",
            description="Password in source code",
        )

        mock_response = MagicMock()
        mock_response.logic_findings = []
        mock_response.security_findings = [finding_with_confidence]
        mock_response.quality_findings = []
        mock_response.duplicates_removed = 0
        mock_response.misattributions_fixed = 0

        with patch("app.agents.critique.LLMService") as MockLLM:
            mock_llm = MagicMock()
            mock_llm.invoke_structured.return_value = mock_response
            MockLLM.return_value = mock_llm

            agent = CritiqueAgent()
            result = agent.critique(
                logic_findings=[],
                security_findings=[finding],
                quality_findings=[],
            )

            assert result.security_findings[0].confidence == "high"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_critique_agent.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.agents.critique'"

**Step 3: Add critique prompt to prompts.py**

```python
# Add to backend/app/agents/prompts.py

CRITIQUE_AGENT_PROMPT = """You are a Critique Agent for CodeGuard AI. Your job is to review findings from other agents and improve their quality.

## Input Findings

LOGIC FINDINGS:
{logic_findings}

SECURITY FINDINGS:
{security_findings}

QUALITY FINDINGS:
{quality_findings}

## Your Tasks

1. **Remove Duplicates**: If multiple agents reported the same issue (even with different wording), keep only the best-written one in the most appropriate category. Count how many duplicates you remove.

2. **Fix Misattributions**: If a finding is in the wrong category, move it to the correct one:
   - Security issues (injection, XSS, secrets, auth) → security_findings
   - Logic bugs (null checks, off-by-one, type errors) → logic_findings
   - Style/maintainability (naming, complexity, docs) → quality_findings
   Count how many you move.

3. **Assign Confidence**: Rate each finding:
   - high: Clear-cut issue that is definitely a problem
   - medium: Likely an issue, but could be context-dependent
   - low: Possible issue, might be intentional or framework-specific

4. **Filter False Positives**: Remove findings that are clearly not issues:
   - Test files with intentionally bad code
   - Framework-specific patterns that look wrong but are correct
   - Comments or documentation examples

## Output Format

Return a CritiqueResponse with:
- logic_findings: Cleaned list of logic findings
- security_findings: Cleaned list of security findings
- quality_findings: Cleaned list of quality findings
- duplicates_removed: Number of duplicate findings removed
- misattributions_fixed: Number of findings moved to correct category
- summary: Brief summary of what you did

Be conservative - only remove findings you are confident are duplicates or false positives."""
```

**Step 4: Create critique.py**

```python
# backend/app/agents/critique.py
"""Critique Agent for reviewing and improving findings from other agents."""

from typing import List, Optional

from app.agents.prompts import CRITIQUE_AGENT_PROMPT
from app.agents.schemas import AgentFinding, CritiqueResponse
from app.services.llm import LLMService


class CritiqueAgent:
    """Agent that reviews findings from other agents to improve quality.

    The Critique Agent:
    1. Removes duplicate findings across agents
    2. Fixes misattributed findings (moves to correct category)
    3. Adds confidence scores to each finding
    4. Filters obvious false positives
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        """Initialize the Critique Agent.

        Args:
            llm_service: Optional LLM service. If not provided, creates new instance.
        """
        self.llm_service = llm_service if llm_service is not None else LLMService()

    def critique(
        self,
        logic_findings: List[AgentFinding],
        security_findings: List[AgentFinding],
        quality_findings: List[AgentFinding],
    ) -> CritiqueResponse:
        """Review and improve findings from all agents.

        Args:
            logic_findings: Findings from the Logic Agent
            security_findings: Findings from the Security Agent
            quality_findings: Findings from the Quality Agent

        Returns:
            CritiqueResponse with cleaned and improved findings
        """
        # Format findings for the prompt
        logic_str = self._format_findings(logic_findings, "Logic")
        security_str = self._format_findings(security_findings, "Security")
        quality_str = self._format_findings(quality_findings, "Quality")

        prompt = CRITIQUE_AGENT_PROMPT.format(
            logic_findings=logic_str,
            security_findings=security_str,
            quality_findings=quality_str,
        )

        response = self.llm_service.invoke_structured(prompt, CritiqueResponse)
        return response

    def _format_findings(self, findings: List[AgentFinding], agent_name: str) -> str:
        """Format findings list as string for prompt.

        Args:
            findings: List of findings to format
            agent_name: Name of the agent that produced these findings

        Returns:
            Formatted string representation of findings
        """
        if not findings:
            return "No findings"

        lines = []
        for i, f in enumerate(findings, 1):
            lines.append(f"{i}. [{f.severity.upper()}] {f.title}")
            lines.append(f"   File: {f.file_path}" + (f":{f.line_number}" if f.line_number else ""))
            lines.append(f"   Description: {f.description}")
            if f.suggestion:
                lines.append(f"   Suggestion: {f.suggestion}")
            lines.append("")

        return "\n".join(lines)
```

**Step 5: Update agents/__init__.py**

```python
# Add to backend/app/agents/__init__.py
from app.agents.critique import CritiqueAgent
```

**Step 6: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_critique_agent.py -v`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/app/agents/critique.py backend/app/agents/prompts.py backend/app/agents/__init__.py backend/tests/test_critique_agent.py
git commit -m "feat: add Critique Agent for deduplication and confidence scoring"
```

---

## Task 5: Integrate Critique Agent into Supervisor

**Files:**
- Modify: `backend/app/agents/supervisor.py`
- Modify: `backend/tests/test_supervisor.py`

**Step 1: Write the failing test**

```python
# Add to backend/tests/test_supervisor.py

def test_supervisor_runs_critique_agent():
    """Test that supervisor runs critique agent after other agents."""
    from app.agents.supervisor import ReviewSupervisor
    from unittest.mock import patch, MagicMock

    mock_finding = MagicMock()
    mock_finding.severity = "warning"
    mock_finding.confidence = "high"
    mock_finding.file_path = "test.py"
    mock_finding.line_number = 1
    mock_finding.title = "Test"
    mock_finding.description = "Test"
    mock_finding.suggestion = None

    with patch("app.agents.supervisor.LogicAgent") as MockLogic, \
         patch("app.agents.supervisor.SecurityAgent") as MockSecurity, \
         patch("app.agents.supervisor.QualityAgent") as MockQuality, \
         patch("app.agents.supervisor.CritiqueAgent") as MockCritique:

        # Setup mocks
        MockLogic.return_value.analyze.return_value = [mock_finding]
        MockSecurity.return_value.analyze.return_value = []
        MockQuality.return_value.analyze.return_value = []

        mock_critique_response = MagicMock()
        mock_critique_response.logic_findings = [mock_finding]
        mock_critique_response.security_findings = []
        mock_critique_response.quality_findings = []
        mock_critique_response.duplicates_removed = 0
        mock_critique_response.misattributions_fixed = 0
        MockCritique.return_value.critique.return_value = mock_critique_response

        supervisor = ReviewSupervisor()
        result = supervisor.run("diff content", ["test.py"])

        # Verify critique was called
        MockCritique.return_value.critique.assert_called_once()
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_supervisor.py -v -k "critique"`
Expected: FAIL (CritiqueAgent not imported/used)

**Step 3: Update supervisor.py to integrate Critique Agent**

```python
# backend/app/agents/supervisor.py
"""Supervisor agent that orchestrates the code review workflow."""

from typing import List

from langgraph.graph import END, START, StateGraph

from app.agents.critique import CritiqueAgent
from app.agents.formatter import CommentFormatter
from app.agents.logic_agent import LogicAgent
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, ReviewState
from app.agents.security_agent import SecurityAgent
from app.services.llm import LLMService


def create_review_graph(llm_service: LLMService) -> StateGraph:
    """Create the LangGraph workflow for code review.

    The workflow runs three agents in parallel (logic, security, quality),
    then runs the critique agent to improve findings, and finally combines
    results into a formatted comment.

    Args:
        llm_service: Shared LLM service for all agents.

    Returns:
        Compiled StateGraph ready for execution.
    """
    # Initialize agents
    logic_agent = LogicAgent(llm_service=llm_service)
    security_agent = SecurityAgent(llm_service=llm_service)
    quality_agent = QualityAgent(llm_service=llm_service)
    critique_agent = CritiqueAgent(llm_service=llm_service)

    def run_logic(state: ReviewState) -> dict:
        """Run logic agent and return findings."""
        findings = logic_agent.analyze(state["pr_diff"], state["pr_files"])
        return {"logic_findings": findings}

    def run_security(state: ReviewState) -> dict:
        """Run security agent and return findings."""
        findings = security_agent.analyze(state["pr_diff"], state["pr_files"])
        return {"security_findings": findings}

    def run_quality(state: ReviewState) -> dict:
        """Run quality agent and return findings."""
        findings = quality_agent.analyze(state["pr_diff"], state["pr_files"])
        return {"quality_findings": findings}

    def run_critique(state: ReviewState) -> dict:
        """Run critique agent to improve findings."""
        result = critique_agent.critique(
            logic_findings=state["logic_findings"],
            security_findings=state["security_findings"],
            quality_findings=state["quality_findings"],
        )
        return {
            "logic_findings": result.logic_findings,
            "security_findings": result.security_findings,
            "quality_findings": result.quality_findings,
        }

    def combine_results(state: ReviewState) -> dict:
        """Combine all findings into a formatted comment."""
        all_findings: List[AgentFinding] = (
            state["logic_findings"]
            + state["security_findings"]
            + state["quality_findings"]
        )
        comment = CommentFormatter.format(all_findings)
        return {"final_comment": comment}

    # Build graph
    graph = StateGraph(ReviewState)

    # Add nodes
    graph.add_node("logic", run_logic)
    graph.add_node("security", run_security)
    graph.add_node("quality", run_quality)
    graph.add_node("critique", run_critique)
    graph.add_node("combine", combine_results)

    # Add edges - run three agents in parallel, then critique, then combine
    graph.add_edge(START, "logic")
    graph.add_edge(START, "security")
    graph.add_edge(START, "quality")
    graph.add_edge("logic", "critique")
    graph.add_edge("security", "critique")
    graph.add_edge("quality", "critique")
    graph.add_edge("critique", "combine")
    graph.add_edge("combine", END)

    return graph.compile()


class ReviewSupervisor:
    """Orchestrates the multi-agent code review process.

    The supervisor manages the workflow of running multiple specialized
    agents in parallel, critiquing their findings, and combining their
    results into a final review comment.
    """

    def __init__(self, llm_service: LLMService = None):
        """Initialize the review supervisor.

        Args:
            llm_service: Optional shared LLM service. Creates new if not provided.
        """
        self.llm_service = llm_service if llm_service is not None else LLMService()
        self.graph = create_review_graph(self.llm_service)

    def run(self, pr_diff: str, pr_files: List[str]) -> ReviewState:
        """Execute the code review workflow.

        Args:
            pr_diff: The pull request diff to analyze.
            pr_files: List of files changed in the PR.

        Returns:
            ReviewState containing all findings and the formatted comment.
        """
        initial_state: ReviewState = {
            "pr_diff": pr_diff,
            "pr_files": pr_files,
            "logic_findings": [],
            "security_findings": [],
            "quality_findings": [],
            "final_comment": "",
        }

        final_state = self.graph.invoke(initial_state)
        return final_state
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_supervisor.py -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add backend/app/agents/supervisor.py backend/tests/test_supervisor.py
git commit -m "feat: integrate Critique Agent into review workflow"
```

---

## Task 6: Progress Broadcasting in Worker

**Files:**
- Modify: `backend/app/worker/processor.py`
- Modify: `backend/tests/test_worker.py`

**Step 1: Write the failing test**

```python
# Add to backend/tests/test_worker.py

@pytest.mark.asyncio
async def test_worker_broadcasts_progress():
    """Test that worker broadcasts progress at each stage."""
    from app.worker.processor import process_review, broadcast_progress
    from unittest.mock import patch, MagicMock, AsyncMock

    broadcasts = []

    async def mock_broadcast(review_id, data):
        broadcasts.append(data)

    with patch("app.worker.processor.broadcast_progress", side_effect=mock_broadcast):
        with patch("app.worker.processor.ReviewRepo") as MockReviewRepo, \
             patch("app.worker.processor.FindingRepo"), \
             patch("app.worker.processor.GitHubService") as MockGH, \
             patch("app.worker.processor.ReviewSupervisor") as MockSupervisor, \
             patch("app.worker.processor.get_db"):

            mock_review = MagicMock()
            mock_review.id = "test-123"
            MockReviewRepo.return_value.get_by_id.return_value = mock_review
            MockReviewRepo.return_value.update_status.return_value = mock_review

            MockGH.return_value.get_pr_diff.return_value = "diff"

            mock_result = {
                "logic_findings": [],
                "security_findings": [],
                "quality_findings": [],
                "final_comment": "No issues",
            }
            MockSupervisor.return_value.run.return_value = mock_result
            MockGH.return_value.post_comment.return_value = 123

            # Run worker
            job_data = {
                "review_id": "test-123",
                "owner": "test",
                "repo": "repo",
                "pr_number": 1,
                "commit_sha": "abc",
            }
            process_review(job_data)

            # Verify progress broadcasts
            stages = [b["stage"] for b in broadcasts]
            assert "fetching_diff" in stages
            assert "complete" in stages
```

**Step 2: Update processor.py with progress broadcasting**

```python
# backend/app/worker/processor.py
"""Background worker for processing code reviews."""

import asyncio
import re
import traceback
from typing import Any, Dict, List
from uuid import UUID

from app.agents.supervisor import ReviewSupervisor
from app.db.database import get_db
from app.db.repositories import FindingRepo, ReviewRepo
from app.models import AgentType, FindingCreate, ReviewStatus, Severity
from app.services.github import GitHubService
from app.services.queue import RateLimiter, get_redis_client
from app.services.websocket import manager as ws_manager


# Progress stages with percentages
PROGRESS_STAGES = {
    "fetching_diff": (10, "Fetching PR diff from GitHub"),
    "logic_agent": (25, "Running Logic Agent"),
    "security_agent": (40, "Running Security Agent"),
    "quality_agent": (55, "Running Quality Agent"),
    "critique_agent": (70, "Running Critique Agent"),
    "deduplicating": (80, "Deduplicating findings"),
    "formatting": (90, "Formatting comment"),
    "posting": (95, "Posting to GitHub"),
    "complete": (100, "Review complete"),
}


def broadcast_progress(review_id: str, stage: str) -> None:
    """Broadcast progress update to connected WebSocket clients.

    Args:
        review_id: The review ID to broadcast to
        stage: The current stage name
    """
    if stage not in PROGRESS_STAGES:
        return

    progress, message = PROGRESS_STAGES[stage]
    data = {
        "stage": stage,
        "progress": progress,
        "message": message,
    }

    # Run async broadcast in sync context
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast(review_id, data))
        else:
            loop.run_until_complete(ws_manager.broadcast(review_id, data))
    except RuntimeError:
        # No event loop, create one
        asyncio.run(ws_manager.broadcast(review_id, data))


def update_review_progress(review_repo: ReviewRepo, review_id: UUID, stage: str, progress: int) -> None:
    """Update review progress in database.

    Args:
        review_repo: ReviewRepo instance
        review_id: The review ID to update
        stage: Current stage name
        progress: Progress percentage
    """
    # This requires adding an update_progress method to ReviewRepo
    # For now, we'll just broadcast - DB update can be added later
    pass


def map_agent_severity(agent_severity: str) -> Severity:
    """Map agent severity to database Severity enum.

    Args:
        agent_severity: Severity string from agent (critical, warning, info)

    Returns:
        Corresponding Severity enum value
    """
    mapping = {
        "critical": Severity.CRITICAL,
        "warning": Severity.MEDIUM,
        "info": Severity.INFO,
    }
    return mapping.get(agent_severity, Severity.INFO)


def map_agent_type(agent_type_str: str) -> AgentType:
    """Map agent type string to AgentType enum.

    Args:
        agent_type_str: Agent type string (logic, security, quality)

    Returns:
        Corresponding AgentType enum value
    """
    mapping = {
        "logic": AgentType.LOGIC,
        "security": AgentType.SECURITY,
        "quality": AgentType.QUALITY,
    }
    return mapping.get(agent_type_str, AgentType.LOGIC)


def extract_files_from_diff(diff: str) -> List[str]:
    """Extract file paths from a unified diff.

    Args:
        diff: Unified diff string

    Returns:
        List of file paths found in the diff
    """
    files = []
    pattern = r"^diff --git a/(.+?) b/"
    for match in re.finditer(pattern, diff, re.MULTILINE):
        files.append(match.group(1))
    return files


def process_review(job_data: Dict[str, Any]) -> None:
    """Process a code review job.

    This is the main worker function that:
    1. Fetches the PR diff from GitHub
    2. Runs the review supervisor (all agents + critique)
    3. Saves findings to the database
    4. Posts a comment to the PR

    Args:
        job_data: Dictionary containing:
            - review_id: UUID of the review record
            - owner: GitHub repository owner
            - repo: GitHub repository name
            - pr_number: Pull request number
            - commit_sha: Commit SHA being reviewed
    """
    review_id = job_data["review_id"]
    owner = job_data["owner"]
    repo = job_data["repo"]
    pr_number = job_data["pr_number"]

    # Initialize services
    db = get_db()
    review_repo = ReviewRepo(db)
    finding_repo = FindingRepo(db)
    github_service = GitHubService()

    try:
        # Update status to processing
        review_repo.update_status(UUID(review_id), ReviewStatus.PROCESSING)

        # Stage 1: Fetch diff
        broadcast_progress(review_id, "fetching_diff")
        diff = github_service.get_pr_diff(owner, repo, pr_number)
        files = extract_files_from_diff(diff)

        # Check rate limit
        try:
            redis = get_redis_client()
            rate_limiter = RateLimiter(redis)

            retries = 0
            max_retries = 3
            while not rate_limiter.can_proceed("gemini") and retries < max_retries:
                import time
                time.sleep(5)
                retries += 1

            if retries >= max_retries:
                raise Exception("Rate limit exceeded after retries")
        except ValueError:
            # Redis not configured, skip rate limiting
            pass

        # Stage 2-5: Run agents (supervisor handles internally)
        # We broadcast stages here for visibility
        broadcast_progress(review_id, "logic_agent")

        supervisor = ReviewSupervisor()
        result = supervisor.run(diff, files)

        # Stages happen inside supervisor, but we mark critique done here
        broadcast_progress(review_id, "critique_agent")

        # Stage 6: Deduplicate (already done by critique agent)
        broadcast_progress(review_id, "deduplicating")

        # Increment rate limit counter
        try:
            rate_limiter.increment("gemini")
        except:
            pass

        # Stage 7: Format and save findings
        broadcast_progress(review_id, "formatting")

        # Map and save findings
        all_findings: List[FindingCreate] = []

        for finding in result["logic_findings"]:
            all_findings.append(
                FindingCreate(
                    review_id=UUID(review_id),
                    agent_type=AgentType.LOGIC,
                    severity=map_agent_severity(finding.severity),
                    file_path=finding.file_path,
                    line_number=finding.line_number,
                    title=finding.title,
                    description=finding.description,
                    suggestion=finding.suggestion,
                    confidence=getattr(finding, 'confidence', 'medium'),
                )
            )

        for finding in result["security_findings"]:
            all_findings.append(
                FindingCreate(
                    review_id=UUID(review_id),
                    agent_type=AgentType.SECURITY,
                    severity=map_agent_severity(finding.severity),
                    file_path=finding.file_path,
                    line_number=finding.line_number,
                    title=finding.title,
                    description=finding.description,
                    suggestion=finding.suggestion,
                    confidence=getattr(finding, 'confidence', 'medium'),
                )
            )

        for finding in result["quality_findings"]:
            all_findings.append(
                FindingCreate(
                    review_id=UUID(review_id),
                    agent_type=AgentType.QUALITY,
                    severity=map_agent_severity(finding.severity),
                    file_path=finding.file_path,
                    line_number=finding.line_number,
                    title=finding.title,
                    description=finding.description,
                    suggestion=finding.suggestion,
                    confidence=getattr(finding, 'confidence', 'medium'),
                )
            )

        # Batch insert findings
        if all_findings:
            finding_repo.create_many(all_findings)

        # Stage 8: Post to GitHub
        broadcast_progress(review_id, "posting")
        comment_id = github_service.post_comment(
            owner, repo, pr_number, result["final_comment"]
        )

        # Complete
        review_repo.update_status(
            UUID(review_id), ReviewStatus.COMPLETED, comment_id=comment_id
        )
        broadcast_progress(review_id, "complete")

        print(f"Review {review_id}: completed with {len(all_findings)} findings")

    except Exception as e:
        # Update status to failed
        review_repo.update_status(UUID(review_id), ReviewStatus.FAILED)
        print(f"Review {review_id}: failed with error: {e}")
        traceback.print_exc()
```

**Step 3: Update FindingCreate model to include confidence**

```python
# Add to backend/app/models/finding.py in FindingCreate class

confidence: str = "medium"
```

**Step 4: Update FindingRepo.create_many to handle confidence**

The confidence field should already be handled since we're using model_dump().

**Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_worker.py -v`
Expected: Tests pass

**Step 6: Commit**

```bash
git add backend/app/worker/processor.py backend/app/models/finding.py
git commit -m "feat: add progress broadcasting to worker"
```

---

## Task 7: False Positive API Endpoint

**Files:**
- Modify: `backend/app/api/reviews.py`
- Modify: `backend/app/db/repositories.py`
- Create: `backend/tests/test_false_positive.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_false_positive.py
"""Tests for false positive marking."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.main import app


class TestFalsePositiveEndpoint:
    """Tests for PUT /api/findings/{id}/false-positive."""

    def setup_method(self):
        self.client = TestClient(app)

    def test_mark_false_positive(self):
        """Test marking a finding as false positive."""
        finding_id = uuid4()

        mock_finding = MagicMock()
        mock_finding.id = finding_id
        mock_finding.is_false_positive = True
        mock_finding.false_positive_reason = "Test code"

        with patch("app.api.reviews.get_finding_repo") as mock_get_repo:
            mock_repo = MagicMock()
            mock_repo.mark_false_positive.return_value = mock_finding
            mock_get_repo.return_value = mock_repo

            response = self.client.put(
                f"/api/findings/{finding_id}/false-positive",
                json={"is_false_positive": True, "reason": "Test code"},
            )

            assert response.status_code == 200
            mock_repo.mark_false_positive.assert_called_once()

    def test_unmark_false_positive(self):
        """Test unmarking a finding as false positive."""
        finding_id = uuid4()

        mock_finding = MagicMock()
        mock_finding.id = finding_id
        mock_finding.is_false_positive = False
        mock_finding.false_positive_reason = None

        with patch("app.api.reviews.get_finding_repo") as mock_get_repo:
            mock_repo = MagicMock()
            mock_repo.mark_false_positive.return_value = mock_finding
            mock_get_repo.return_value = mock_repo

            response = self.client.put(
                f"/api/findings/{finding_id}/false-positive",
                json={"is_false_positive": False},
            )

            assert response.status_code == 200

    def test_false_positive_finding_not_found(self):
        """Test 404 when finding not found."""
        finding_id = uuid4()

        with patch("app.api.reviews.get_finding_repo") as mock_get_repo:
            mock_repo = MagicMock()
            mock_repo.mark_false_positive.return_value = None
            mock_get_repo.return_value = mock_repo

            response = self.client.put(
                f"/api/findings/{finding_id}/false-positive",
                json={"is_false_positive": True},
            )

            assert response.status_code == 404
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_false_positive.py -v`
Expected: FAIL (endpoint doesn't exist)

**Step 3: Add mark_false_positive to FindingRepo**

```python
# Add to backend/app/db/repositories.py in FindingRepo class

def mark_false_positive(
    self, finding_id: UUID, is_false_positive: bool, reason: Optional[str] = None
) -> Optional[Finding]:
    """Mark a finding as false positive.

    Args:
        finding_id: The finding ID to update
        is_false_positive: Whether to mark as false positive
        reason: Optional reason for marking

    Returns:
        Updated Finding or None if not found
    """
    update_data = {
        "is_false_positive": is_false_positive,
        "false_positive_reason": reason if is_false_positive else None,
    }

    result = (
        self.client.table(self.table)
        .update(update_data)
        .eq("id", str(finding_id))
        .execute()
    )

    if result.data:
        return Finding(**result.data[0])
    return None
```

**Step 4: Add endpoint to reviews.py**

```python
# Add to backend/app/api/reviews.py

from pydantic import BaseModel

class FalsePositiveRequest(BaseModel):
    """Request body for marking false positive."""
    is_false_positive: bool
    reason: Optional[str] = None


@router.put("/findings/{finding_id}/false-positive")
def mark_false_positive(
    finding_id: UUID,
    request: FalsePositiveRequest,
    finding_repo: Annotated[FindingRepo, Depends(get_finding_repo)],
):
    """Mark a finding as false positive."""
    finding = finding_repo.mark_false_positive(
        finding_id,
        request.is_false_positive,
        request.reason,
    )

    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    return finding
```

**Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_false_positive.py -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add backend/app/api/reviews.py backend/app/db/repositories.py backend/tests/test_false_positive.py
git commit -m "feat: add false positive marking endpoint"
```

---

## Task 8: Frontend - WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`

**Step 1: Create the hook**

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useState, useEffect, useRef, useCallback } from 'react'

interface WebSocketOptions {
  onMessage?: (data: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnectAttempts?: number
  reconnectInterval?: number
}

interface WebSocketState {
  isConnected: boolean
  lastMessage: any | null
  error: Event | null
}

export function useWebSocket(url: string | null, options: WebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 3,
    reconnectInterval = 3000,
  } = options

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    error: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (!url) return

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, error: null }))
        reconnectCountRef.current = 0
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setState(prev => ({ ...prev, lastMessage: data }))
          onMessage?.(data)
        } catch {
          // Not JSON, use raw data
          setState(prev => ({ ...prev, lastMessage: event.data }))
          onMessage?.(event.data)
        }
      }

      ws.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false }))
        onDisconnect?.()

        // Attempt reconnect
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        setState(prev => ({ ...prev, error }))
        onError?.(error)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('WebSocket connection error:', error)
    }
  }, [url, onMessage, onConnect, onDisconnect, onError, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    reconnectCountRef.current = reconnectAttempts // Prevent reconnect
    wsRef.current?.close()
  }, [reconnectAttempts])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  }
}
```

**Step 2: Create useReviewProgress hook**

```typescript
// frontend/src/hooks/useReviewProgress.ts
import { useState, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

interface ProgressState {
  stage: string
  progress: number
  message: string
  isConnected: boolean
  isComplete: boolean
}

export function useReviewProgress(reviewId: string | null, enabled = true) {
  const [state, setState] = useState<ProgressState>({
    stage: '',
    progress: 0,
    message: '',
    isConnected: false,
    isComplete: false,
  })

  const wsUrl = enabled && reviewId
    ? `ws://${window.location.hostname}:5000/ws/reviews/${reviewId}`
    : null

  const { isConnected, lastMessage } = useWebSocket(wsUrl, {
    onMessage: (data) => {
      setState(prev => ({
        ...prev,
        stage: data.stage,
        progress: data.progress,
        message: data.message,
        isComplete: data.stage === 'complete',
      }))
    },
    onConnect: () => {
      setState(prev => ({ ...prev, isConnected: true }))
    },
    onDisconnect: () => {
      setState(prev => ({ ...prev, isConnected: false }))
    },
  })

  useEffect(() => {
    setState(prev => ({ ...prev, isConnected }))
  }, [isConnected])

  return state
}
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useWebSocket.ts frontend/src/hooks/useReviewProgress.ts
git commit -m "feat: add WebSocket and review progress hooks"
```

---

## Task 9: Frontend - Progress Bar Component

**Files:**
- Create: `frontend/src/components/ProgressBar.tsx`
- Create: `frontend/src/context/ProgressContext.tsx`

**Step 1: Create Progress Context**

```typescript
// frontend/src/context/ProgressContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react'

interface ActiveReview {
  reviewId: string
  prNumber: number
  prTitle: string
}

interface ProgressContextType {
  activeReview: ActiveReview | null
  setActiveReview: (review: ActiveReview | null) => void
}

const ProgressContext = createContext<ProgressContextType | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [activeReview, setActiveReview] = useState<ActiveReview | null>(null)

  return (
    <ProgressContext.Provider value={{ activeReview, setActiveReview }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgressContext() {
  const context = useContext(ProgressContext)
  if (!context) {
    throw new Error('useProgressContext must be used within ProgressProvider')
  }
  return context
}
```

**Step 2: Create Progress Bar Component**

```typescript
// frontend/src/components/ProgressBar.tsx
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, CheckCircle } from 'lucide-react'
import { useProgressContext } from '../context/ProgressContext'
import { useReviewProgress } from '../hooks/useReviewProgress'

export function GlobalProgressBar() {
  const navigate = useNavigate()
  const { activeReview, setActiveReview } = useProgressContext()
  const progress = useReviewProgress(activeReview?.reviewId ?? null, !!activeReview)

  const handleClick = () => {
    if (activeReview) {
      navigate(`/reviews/${activeReview.reviewId}`)
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveReview(null)
  }

  // Auto-dismiss when complete
  if (progress.isComplete && activeReview) {
    setTimeout(() => setActiveReview(null), 3000)
  }

  return (
    <AnimatePresence>
      {activeReview && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 cursor-pointer"
          onClick={handleClick}
        >
          <div className="bg-void-100 border-b border-white/10 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Status */}
                <div className="flex items-center gap-3">
                  {progress.isComplete ? (
                    <CheckCircle className="text-cyber-green" size={20} />
                  ) : (
                    <Loader2 className="text-cyber-cyan animate-spin" size={20} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {progress.isComplete ? 'Review Complete' : 'Reviewing'} PR #{activeReview.prNumber}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {progress.message || activeReview.prTitle}
                    </p>
                  </div>
                </div>

                {/* Center: Progress Bar */}
                <div className="flex-1 max-w-md">
                  <div className="h-2 bg-void-300 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: progress.isComplete
                          ? 'var(--cyber-green)'
                          : 'linear-gradient(90deg, var(--cyber-cyan), var(--cyber-magenta))',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Right: Percentage & Close */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-cyber-cyan">
                    {progress.progress}%
                  </span>
                  <button
                    onClick={handleDismiss}
                    className="p-1 rounded hover:bg-void-200 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ProgressBar.tsx frontend/src/context/ProgressContext.tsx
git commit -m "feat: add global progress bar component"
```

---

## Task 10: Frontend - Toast Notifications

**Files:**
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/context/ToastContext.tsx`

**Step 1: Create Toast Context**

```typescript
// frontend/src/context/ToastContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-2), { ...toast, id }]) // Keep max 3

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
```

**Step 2: Create Toast Component**

```typescript
// frontend/src/components/Toast.tsx
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToast, ToastType } from '../context/ToastContext'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const colors: Record<ToastType, string> = {
  success: 'var(--cyber-green)',
  error: 'var(--cyber-crimson)',
  info: 'var(--cyber-cyan)',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => {
          const Icon = icons[toast.type]
          const color = colors[toast.type]

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="glass-card p-4 min-w-[300px] max-w-[400px]"
              style={{ borderColor: `${color}30` }}
            >
              <div className="flex items-start gap-3">
                <Icon size={20} style={{ color }} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-white">{toast.message}</p>
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="text-xs font-mono mt-1 hover:underline"
                      style={{ color }}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded hover:bg-void-200 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/Toast.tsx frontend/src/context/ToastContext.tsx
git commit -m "feat: add toast notification system"
```

---

## Task 11: Frontend - Activity Feed Component

**Files:**
- Create: `frontend/src/components/ActivityFeed.tsx`

**Step 1: Create Activity Feed Component**

```typescript
// frontend/src/components/ActivityFeed.tsx
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, Clock, XCircle, FolderGit2 } from 'lucide-react'
import { useReviews } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'

const statusConfig = {
  completed: { icon: CheckCircle, color: 'var(--cyber-green)', label: 'completed' },
  processing: { icon: Clock, color: 'var(--cyber-cyan)', label: 'started' },
  pending: { icon: Clock, color: 'var(--cyber-amber)', label: 'queued' },
  failed: { icon: XCircle, color: 'var(--cyber-crimson)', label: 'failed' },
}

export function ActivityFeed() {
  const navigate = useNavigate()
  const { data } = useReviews(1, 10)

  const activities = data?.items.map(review => ({
    id: review.id,
    type: 'review' as const,
    status: review.status,
    prNumber: review.pr_number,
    prTitle: review.pr_title,
    timestamp: review.completed_at || review.created_at,
  })) ?? []

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4">
        Recent Activity
      </h3>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No recent activity
          </p>
        ) : (
          activities.map((activity, index) => {
            const config = statusConfig[activity.status]
            const Icon = config.icon

            return (
              <motion.button
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/reviews/${activity.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-void-200 transition-colors text-left"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  <Icon size={16} style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    PR #{activity.prNumber} {config.label}
                  </p>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {activity.prTitle}
                  </p>
                </div>
                <span className="text-xs text-gray-600 font-mono whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ActivityFeed.tsx
git commit -m "feat: add activity feed component"
```

---

## Task 12: Frontend - Findings Grouped by File

**Files:**
- Create: `frontend/src/components/FindingsByFile.tsx`

**Step 1: Create FindingsByFile Component**

```typescript
// frontend/src/components/FindingsByFile.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  File,
  Copy,
  Flag,
  AlertTriangle,
  AlertCircle,
  Info,
  Check
} from 'lucide-react'
import type { Finding } from '../types'

interface FindingsByFileProps {
  findings: Finding[]
  onMarkFalsePositive: (findingId: string, reason?: string) => void
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: '#ff3366', label: 'Critical' },
  high: { icon: AlertTriangle, color: '#ff6644', label: 'High' },
  medium: { icon: AlertCircle, color: '#ffaa00', label: 'Medium' },
  low: { icon: AlertCircle, color: '#88cc00', label: 'Low' },
  info: { icon: Info, color: '#00f0ff', label: 'Info' },
}

const confidenceConfig = {
  high: { color: '#00ff88', label: 'High' },
  medium: { color: '#ffaa00', label: 'Medium' },
  low: { color: '#666666', label: 'Low' },
}

const agentConfig = {
  logic: { color: '#00f0ff', label: 'Logic' },
  security: { color: '#ff00aa', label: 'Security' },
  quality: { color: '#00ff88', label: 'Quality' },
}

function FindingCard({
  finding,
  onMarkFalsePositive
}: {
  finding: Finding
  onMarkFalsePositive: (findingId: string, reason?: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showFPModal, setShowFPModal] = useState(false)
  const [fpReason, setFPReason] = useState('')

  const severity = severityConfig[finding.severity] || severityConfig.info
  const confidence = confidenceConfig[finding.confidence || 'medium']
  const agent = agentConfig[finding.agent_type]
  const SeverityIcon = severity.icon

  const handleCopy = () => {
    if (finding.suggestion) {
      navigator.clipboard.writeText(finding.suggestion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleFalsePositive = () => {
    onMarkFalsePositive(finding.id, fpReason || undefined)
    setShowFPModal(false)
    setFPReason('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-l-2 pl-4 py-2 ${finding.is_false_positive ? 'opacity-50' : ''}`}
      style={{ borderColor: severity.color }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-500 mt-1 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-500 mt-1 flex-shrink-0" />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityIcon size={14} style={{ color: severity.color }} />
            <span
              className={`text-sm font-medium ${finding.is_false_positive ? 'line-through' : ''}`}
              style={{ color: finding.is_false_positive ? '#666' : 'white' }}
            >
              {finding.title}
            </span>

            {/* Badges */}
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
            >
              {agent.label}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: `${confidence.color}20`, color: confidence.color }}
            >
              {confidence.label}
            </span>

            {finding.line_number && (
              <span className="text-xs text-gray-500 font-mono">
                :{finding.line_number}
              </span>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-6 space-y-2">
              <p className="text-sm text-gray-300">{finding.description}</p>

              {finding.suggestion && (
                <div className="p-3 rounded-lg bg-cyber-green/5 border border-cyber-green/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-cyber-green uppercase">
                      Suggestion
                    </span>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-300">{finding.suggestion}</p>
                </div>
              )}

              {!finding.is_false_positive && (
                <button
                  onClick={() => setShowFPModal(true)}
                  className="text-xs text-gray-500 hover:text-cyber-amber flex items-center gap-1"
                >
                  <Flag size={12} />
                  Mark as False Positive
                </button>
              )}

              {/* False Positive Modal */}
              {showFPModal && (
                <div className="p-3 rounded-lg bg-void-200 border border-white/10">
                  <p className="text-sm text-white mb-2">Why is this a false positive?</p>
                  <input
                    type="text"
                    value={fpReason}
                    onChange={(e) => setFPReason(e.target.value)}
                    placeholder="Optional reason..."
                    className="w-full cyber-input text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleFalsePositive}
                      className="text-xs px-3 py-1 rounded bg-cyber-amber/20 text-cyber-amber hover:bg-cyber-amber/30"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowFPModal(false)}
                      className="text-xs px-3 py-1 rounded bg-void-300 text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FindingsByFile({ findings, onMarkFalsePositive }: FindingsByFileProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // Group findings by file
  const fileGroups = findings.reduce((acc, finding) => {
    const file = finding.file_path
    if (!acc[file]) {
      acc[file] = []
    }
    acc[file].push(finding)
    return acc
  }, {} as Record<string, Finding[]>)

  // Sort files by number of findings (descending)
  const sortedFiles = Object.entries(fileGroups).sort(
    ([, a], [, b]) => b.length - a.length
  )

  // Initialize all files as expanded
  if (expandedFiles.size === 0 && sortedFiles.length > 0) {
    setExpandedFiles(new Set(sortedFiles.map(([file]) => file)))
  }

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(file)) {
        next.delete(file)
      } else {
        next.add(file)
      }
      return next
    })
  }

  if (findings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No findings to display</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedFiles.map(([file, fileFindings]) => {
        const isExpanded = expandedFiles.has(file)
        const activeFindings = fileFindings.filter(f => !f.is_false_positive)

        return (
          <div key={file} className="glass-card overflow-hidden">
            <button
              onClick={() => toggleFile(file)}
              className="w-full flex items-center gap-3 p-4 hover:bg-void-50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={18} className="text-gray-400" />
              ) : (
                <ChevronRight size={18} className="text-gray-400" />
              )}
              <File size={18} className="text-cyber-cyan" />
              <span className="flex-1 text-left font-mono text-sm text-white">
                {file}
              </span>
              <span className="text-xs font-mono text-gray-500">
                {activeFindings.length} issue{activeFindings.length !== 1 ? 's' : ''}
              </span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    {fileFindings.map(finding => (
                      <FindingCard
                        key={finding.id}
                        finding={finding}
                        onMarkFalsePositive={onMarkFalsePositive}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/FindingsByFile.tsx
git commit -m "feat: add findings grouped by file component"
```

---

## Task 13: Update Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add new types**

```typescript
// Update frontend/src/types/index.ts

// Add to existing types:

export type Confidence = 'high' | 'medium' | 'low'

// Update Finding interface:
export interface Finding {
  id: string
  review_id: string
  agent_type: AgentType
  severity: Severity
  confidence?: Confidence
  file_path: string
  line_number?: number
  title: string
  description: string
  suggestion?: string
  is_false_positive?: boolean
  false_positive_reason?: string
  created_at: string
}

// Add new interfaces:
export interface ProgressUpdate {
  stage: string
  progress: number
  message: string
}

export interface FalsePositiveRequest {
  is_false_positive: boolean
  reason?: string
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add confidence and false positive types"
```

---

## Task 14: Update App.tsx with Providers

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Update App.tsx**

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { GlobalProgressBar } from './components/ProgressBar'
import { ToastContainer } from './components/Toast'
import { ProgressProvider } from './context/ProgressContext'
import { ToastProvider } from './context/ToastContext'
import { Dashboard } from './pages/Dashboard'
import { Reviews } from './pages/Reviews'
import { ReviewDetail } from './pages/ReviewDetail'
import { Repositories } from './pages/Repositories'
import { RepositorySettings } from './pages/RepositorySettings'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ProgressProvider>
          <BrowserRouter>
            <GlobalProgressBar />
            <Layout>
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/reviews/:reviewId" element={<ReviewDetail />} />
                  <Route path="/repositories" element={<Repositories />} />
                  <Route path="/repositories/:repoId/settings" element={<RepositorySettings />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </AnimatePresence>
            </Layout>
            <ToastContainer />
          </BrowserRouter>
        </ProgressProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
```

**Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add progress and toast providers to App"
```

---

## Task 15: Update Dashboard with Activity Feed

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Add ActivityFeed to Dashboard**

Add the ActivityFeed component import and use it in the Dashboard layout. Find a suitable location in the existing Dashboard layout and add:

```typescript
import { ActivityFeed } from '../components/ActivityFeed'

// Add in the Dashboard component's return, in an appropriate grid section:
<ActivityFeed />
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: add activity feed to dashboard"
```

---

## Task 16: Update ReviewDetail with FindingsByFile

**Files:**
- Modify: `frontend/src/pages/ReviewDetail.tsx`

**Step 1: Update ReviewDetail to use FindingsByFile**

Replace the existing findings display with FindingsByFile component:

```typescript
import { FindingsByFile } from '../components/FindingsByFile'
import { useToast } from '../context/ToastContext'

// In the component:
const { addToast } = useToast()

const handleMarkFalsePositive = async (findingId: string, reason?: string) => {
  try {
    await fetch(`/api/findings/${findingId}/false-positive`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_false_positive: true, reason }),
    })
    addToast({ type: 'success', message: 'Marked as false positive' })
    // Refetch review data
  } catch {
    addToast({ type: 'error', message: 'Failed to mark as false positive' })
  }
}

// Replace findings display with:
<FindingsByFile
  findings={review.findings}
  onMarkFalsePositive={handleMarkFalsePositive}
/>
```

**Step 2: Commit**

```bash
git add frontend/src/pages/ReviewDetail.tsx
git commit -m "feat: use FindingsByFile in review detail page"
```

---

## Task 17: Add False Positive API to Frontend

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/hooks/useApi.ts`

**Step 1: Add API function**

```typescript
// Add to frontend/src/api/client.ts

export async function markFalsePositive(
  findingId: string,
  data: FalsePositiveRequest
): Promise<Finding> {
  return fetchApi<Finding>(`/findings/${findingId}/false-positive`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
```

**Step 2: Add hook**

```typescript
// Add to frontend/src/hooks/useApi.ts

export function useMarkFalsePositive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ findingId, data }: { findingId: string; data: FalsePositiveRequest }) =>
      api.markFalsePositive(findingId, data),
    onSuccess: (_, variables) => {
      // Invalidate the review that contains this finding
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}
```

**Step 3: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/hooks/useApi.ts
git commit -m "feat: add false positive API and hook"
```

---

## Task 18: Final Integration Testing

**Step 1: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All tests pass

**Step 2: Build frontend**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no TypeScript errors

**Step 3: Manual testing checklist**

1. Start backend: `cd backend && python -m uvicorn app.main:app --reload --port 5000`
2. Start frontend: `cd frontend && npm run dev`
3. Open http://localhost:3000

Test the following:
- [ ] Dashboard shows activity feed
- [ ] Create a PR webhook triggers progress bar
- [ ] Progress bar updates in real-time
- [ ] Review detail shows findings grouped by file
- [ ] Findings show confidence badges
- [ ] Mark false positive works
- [ ] Toast notifications appear
- [ ] Toast auto-dismisses after 5s

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete Phase 7 - UI/UX improvements and agent quality"
```

---

## Summary

This plan implements:

1. **WebSocket Progress Tracking** (Tasks 1-2, 6, 8-9)
   - ConnectionManager for managing WebSocket connections
   - Progress broadcasting from worker at each stage
   - Frontend hooks and sticky progress bar

2. **Critique Agent** (Tasks 3-5)
   - New CritiqueResponse schema with confidence
   - CritiqueAgent that deduplicates and adds confidence scores
   - Integration into supervisor workflow

3. **UI Improvements** (Tasks 9-12, 14-16)
   - Global progress bar component
   - Toast notification system
   - Activity feed on dashboard
   - Findings grouped by file with collapsible sections

4. **Workflow Improvements** (Tasks 7, 13, 17)
   - Confidence scores on all findings
   - False positive marking with API and UI

Total: 18 tasks, each with 3-6 steps

---

**Plan complete and saved to `docs/plans/2026-02-04-phase7-implementation-plan.md`.**

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
