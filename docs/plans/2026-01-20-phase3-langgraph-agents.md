# Phase 3: LangGraph Agent Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-agent code review system using LangGraph that runs Logic, Security, and Quality agents in parallel to analyze PR diffs and produce structured findings.

**Architecture:** Three specialized agents (Logic, Security, Quality) run in parallel via LangGraph's StateGraph. Each agent receives the PR diff, analyzes it using Gemini 2.0 Flash, and returns structured findings. A supervisor combines all findings and formats them as a GitHub comment.

**Tech Stack:** LangGraph, LangChain-Google-GenAI, google-generativeai, Pydantic for structured outputs

---

## Prerequisites

- Phase 1 & 2 complete (54 tests passing)
- Dependencies already in `requirements.txt`: `langgraph`, `langchain-core`, `langchain-google-genai`, `google-generativeai`
- `GOOGLE_API_KEY` configured in `.env`

---

## Task 1: Create LLM Service

**Files:**
- Create: `backend/app/services/llm.py`
- Create: `backend/tests/test_llm_service.py`
- Modify: `backend/app/services/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_llm_service.py
"""Tests for LLM service."""

import pytest
from unittest.mock import MagicMock, patch

from app.services.llm import LLMService, get_llm_service


class TestLLMService:
    """Tests for LLMService."""

    def test_init_with_api_key(self):
        """Test initialization with API key."""
        with patch("app.services.llm.ChatGoogleGenerativeAI") as mock_chat:
            service = LLMService(api_key="test-key")
            mock_chat.assert_called_once()
            assert service.model is not None

    def test_init_without_api_key_raises(self):
        """Test that missing API key raises ValueError."""
        with patch("app.services.llm.settings") as mock_settings:
            mock_settings.google_api_key = ""
            with pytest.raises(ValueError, match="Google API key is required"):
                LLMService()

    def test_invoke_returns_content(self):
        """Test that invoke returns model response content."""
        with patch("app.services.llm.ChatGoogleGenerativeAI") as mock_chat:
            mock_model = MagicMock()
            mock_model.invoke.return_value = MagicMock(content="Test response")
            mock_chat.return_value = mock_model

            service = LLMService(api_key="test-key")
            result = service.invoke("Test prompt")

            assert result == "Test response"
            mock_model.invoke.assert_called_once()

    def test_invoke_with_structured_output(self):
        """Test invoke with Pydantic model for structured output."""
        from pydantic import BaseModel

        class TestOutput(BaseModel):
            name: str
            value: int

        with patch("app.services.llm.ChatGoogleGenerativeAI") as mock_chat:
            mock_model = MagicMock()
            mock_structured = MagicMock()
            mock_structured.invoke.return_value = TestOutput(name="test", value=42)
            mock_model.with_structured_output.return_value = mock_structured
            mock_chat.return_value = mock_model

            service = LLMService(api_key="test-key")
            result = service.invoke_structured("Test prompt", TestOutput)

            assert isinstance(result, TestOutput)
            assert result.name == "test"
            assert result.value == 42

    def test_get_llm_service_returns_instance(self):
        """Test get_llm_service dependency function."""
        with patch("app.services.llm.ChatGoogleGenerativeAI"):
            with patch("app.services.llm.settings") as mock_settings:
                mock_settings.google_api_key = "test-key"
                service = get_llm_service()
                assert isinstance(service, LLMService)
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_llm_service.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.llm'`

### Step 3: Write minimal implementation

```python
# backend/app/services/llm.py
"""LLM service for interacting with Google Gemini."""

from typing import Optional, Type, TypeVar

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from app.config import settings

T = TypeVar("T", bound=BaseModel)


class LLMService:
    """Service for LLM operations using Gemini."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize LLM service.

        Args:
            api_key: Google API key. Uses settings if not provided.

        Raises:
            ValueError: If no API key is available.
        """
        self.api_key = api_key or settings.google_api_key
        if not self.api_key:
            raise ValueError("Google API key is required")

        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=self.api_key,
            temperature=0.1,  # Low temperature for consistent analysis
        )

    def invoke(self, prompt: str) -> str:
        """Invoke the model with a prompt.

        Args:
            prompt: The prompt to send to the model.

        Returns:
            The model's response content as a string.
        """
        response = self.model.invoke(prompt)
        return response.content

    def invoke_structured(self, prompt: str, output_schema: Type[T]) -> T:
        """Invoke the model with structured output.

        Args:
            prompt: The prompt to send to the model.
            output_schema: Pydantic model class for structured output.

        Returns:
            Parsed response as the specified Pydantic model.
        """
        structured_model = self.model.with_structured_output(output_schema)
        return structured_model.invoke(prompt)


def get_llm_service() -> LLMService:
    """Get LLMService instance for dependency injection."""
    return LLMService()
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_llm_service.py -v`

Expected: 5 passed

### Step 5: Update services __init__.py

```python
# backend/app/services/__init__.py
"""Services module for CodeGuard AI."""

from app.services.github import GitHubService
from app.services.llm import LLMService, get_llm_service
from app.services.queue import QueueService, RateLimiter, get_redis_client

__all__ = [
    "GitHubService",
    "LLMService",
    "get_llm_service",
    "QueueService",
    "RateLimiter",
    "get_redis_client",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 59 passed

### Step 7: Commit

```bash
git add backend/app/services/llm.py backend/tests/test_llm_service.py backend/app/services/__init__.py
git commit -m "feat: add LLM service for Gemini integration"
```

---

## Task 2: Create Agent Output Models

**Files:**
- Create: `backend/app/agents/schemas.py`
- Create: `backend/tests/test_agent_schemas.py`
- Modify: `backend/app/agents/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_agent_schemas.py
"""Tests for agent schemas."""

import pytest
from pydantic import ValidationError

from app.agents.schemas import (
    AgentFinding,
    AgentResponse,
    ReviewState,
)
from app.models import AgentType, Severity


class TestAgentFinding:
    """Tests for AgentFinding schema."""

    def test_create_valid_finding(self):
        """Test creating a valid finding."""
        finding = AgentFinding(
            severity="warning",
            file_path="src/main.py",
            line_number=42,
            title="Potential null reference",
            description="Variable 'user' may be None",
            suggestion="Add null check before accessing",
        )
        assert finding.severity == "warning"
        assert finding.file_path == "src/main.py"
        assert finding.line_number == 42

    def test_create_finding_without_line_number(self):
        """Test creating finding without line number."""
        finding = AgentFinding(
            severity="info",
            file_path="src/utils.py",
            title="Consider refactoring",
            description="Function is too long",
        )
        assert finding.line_number is None
        assert finding.suggestion is None

    def test_invalid_severity_raises(self):
        """Test that invalid severity raises ValidationError."""
        with pytest.raises(ValidationError):
            AgentFinding(
                severity="invalid",
                file_path="test.py",
                title="Test",
                description="Test",
            )


class TestAgentResponse:
    """Tests for AgentResponse schema."""

    def test_create_response_with_findings(self):
        """Test creating response with findings."""
        response = AgentResponse(
            findings=[
                AgentFinding(
                    severity="critical",
                    file_path="auth.py",
                    line_number=10,
                    title="SQL Injection",
                    description="User input in query",
                    suggestion="Use parameterized queries",
                )
            ],
            summary="Found 1 critical issue",
        )
        assert len(response.findings) == 1
        assert response.summary == "Found 1 critical issue"

    def test_create_empty_response(self):
        """Test creating response with no findings."""
        response = AgentResponse(findings=[], summary="No issues found")
        assert len(response.findings) == 0


class TestReviewState:
    """Tests for ReviewState TypedDict."""

    def test_create_initial_state(self):
        """Test creating initial review state."""
        state: ReviewState = {
            "pr_diff": "diff --git a/test.py",
            "pr_files": ["test.py"],
            "logic_findings": [],
            "security_findings": [],
            "quality_findings": [],
            "final_comment": "",
        }
        assert state["pr_diff"] == "diff --git a/test.py"
        assert len(state["logic_findings"]) == 0
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_agent_schemas.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.schemas'`

### Step 3: Write minimal implementation

```python
# backend/app/agents/schemas.py
"""Schemas for agent inputs and outputs."""

from typing import List, Literal, Optional, TypedDict

from pydantic import BaseModel, Field


class AgentFinding(BaseModel):
    """A single finding from an agent.

    This is the structured output schema that agents return.
    It maps to FindingCreate when persisted to the database.
    """

    severity: Literal["critical", "warning", "info"] = Field(
        description="Severity level: critical (security/crash), warning (bug-prone), info (style)"
    )
    file_path: str = Field(description="Path to the file with the issue")
    line_number: Optional[int] = Field(
        default=None, description="Line number if applicable"
    )
    title: str = Field(description="Short title describing the issue")
    description: str = Field(description="Detailed explanation of the issue")
    suggestion: Optional[str] = Field(
        default=None, description="Suggested fix or improvement"
    )


class AgentResponse(BaseModel):
    """Response from an agent containing all findings."""

    findings: List[AgentFinding] = Field(
        default_factory=list, description="List of findings from analysis"
    )
    summary: str = Field(description="Brief summary of the analysis")


class ReviewState(TypedDict):
    """State for the review graph.

    This TypedDict defines the shape of data flowing through LangGraph.
    """

    pr_diff: str
    pr_files: List[str]
    logic_findings: List[AgentFinding]
    security_findings: List[AgentFinding]
    quality_findings: List[AgentFinding]
    final_comment: str
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_agent_schemas.py -v`

Expected: 6 passed

### Step 5: Update agents __init__.py

```python
# backend/app/agents/__init__.py
"""Agents module for CodeGuard AI."""

from app.agents.schemas import AgentFinding, AgentResponse, ReviewState

__all__ = [
    "AgentFinding",
    "AgentResponse",
    "ReviewState",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 65 passed

### Step 7: Commit

```bash
git add backend/app/agents/schemas.py backend/tests/test_agent_schemas.py backend/app/agents/__init__.py
git commit -m "feat: add agent schemas for structured LLM output"
```

---

## Task 3: Create Prompt Templates

**Files:**
- Create: `backend/app/agents/prompts.py`
- Create: `backend/tests/test_prompts.py`
- Modify: `backend/app/agents/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_prompts.py
"""Tests for agent prompts."""

import pytest

from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    format_prompt,
)


class TestPromptTemplates:
    """Tests for prompt templates."""

    def test_logic_prompt_exists(self):
        """Test that logic agent prompt is defined."""
        assert LOGIC_AGENT_PROMPT is not None
        assert "logic" in LOGIC_AGENT_PROMPT.lower()
        assert "{diff}" in LOGIC_AGENT_PROMPT

    def test_security_prompt_exists(self):
        """Test that security agent prompt is defined."""
        assert SECURITY_AGENT_PROMPT is not None
        assert "security" in SECURITY_AGENT_PROMPT.lower()
        assert "{diff}" in SECURITY_AGENT_PROMPT

    def test_quality_prompt_exists(self):
        """Test that quality agent prompt is defined."""
        assert QUALITY_AGENT_PROMPT is not None
        assert "quality" in QUALITY_AGENT_PROMPT.lower() or "style" in QUALITY_AGENT_PROMPT.lower()
        assert "{diff}" in QUALITY_AGENT_PROMPT


class TestFormatPrompt:
    """Tests for format_prompt function."""

    def test_format_prompt_with_diff(self):
        """Test formatting prompt with diff."""
        template = "Analyze this diff:\n{diff}\n\nFiles: {files}"
        result = format_prompt(
            template,
            diff="+ added line",
            files=["test.py"],
        )
        assert "+ added line" in result
        assert "test.py" in result

    def test_format_prompt_with_empty_diff(self):
        """Test formatting prompt with empty diff."""
        template = "Diff: {diff}"
        result = format_prompt(template, diff="")
        assert result == "Diff: "

    def test_format_prompt_preserves_template(self):
        """Test that formatting preserves non-placeholder text."""
        template = "You are a code reviewer.\n{diff}"
        result = format_prompt(template, diff="test")
        assert "You are a code reviewer." in result
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_prompts.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.prompts'`

### Step 3: Write minimal implementation

```python
# backend/app/agents/prompts.py
"""Prompt templates for code review agents."""

from typing import List

LOGIC_AGENT_PROMPT = """You are an expert code reviewer focused on LOGIC ERRORS in Python code.

Analyze the following Git diff for logic issues. Focus ONLY on:
- Null/None reference errors (accessing attributes on potentially None values)
- Off-by-one errors in loops and array indexing
- Type mismatches and incorrect type handling
- Unreachable code and dead code paths
- Incorrect boolean logic and condition errors
- Race conditions and concurrency issues
- Resource leaks (unclosed files, connections)
- Incorrect error handling (swallowing exceptions, wrong exception types)

DO NOT report:
- Style issues (naming, formatting)
- Security issues (those are handled by another agent)
- Performance issues unless they cause incorrect behavior

For each issue found, provide:
- severity: "critical" (will crash/corrupt data), "warning" (likely bug), "info" (potential issue)
- file_path: exact file path from the diff
- line_number: line number in the new version (lines starting with +)
- title: brief description (under 60 chars)
- description: detailed explanation of the issue
- suggestion: how to fix it

If no logic issues are found, return an empty findings list.

Git diff to analyze:
```diff
{diff}
```

Files changed: {files}
"""

SECURITY_AGENT_PROMPT = """You are an expert security auditor analyzing Python code for vulnerabilities.

Analyze the following Git diff for security issues. Focus ONLY on:
- SQL injection (string concatenation in queries)
- Command injection (os.system, subprocess with shell=True, eval, exec)
- Cross-site scripting (XSS) in web responses
- Hardcoded secrets (API keys, passwords, tokens in code)
- Path traversal (unsanitized file paths)
- Insecure deserialization (pickle, yaml.load without SafeLoader)
- Weak cryptography (MD5, SHA1 for security, weak random)
- Missing authentication/authorization checks
- Sensitive data exposure (logging passwords, returning secrets)
- SSRF vulnerabilities (user-controlled URLs)

DO NOT report:
- Code style issues
- Logic errors (unless they have security implications)
- Performance issues

For each issue found, provide:
- severity: "critical" (exploitable vulnerability), "warning" (potential risk), "info" (best practice)
- file_path: exact file path from the diff
- line_number: line number in the new version (lines starting with +)
- title: brief description (under 60 chars)
- description: detailed explanation including attack vector
- suggestion: secure alternative

If no security issues are found, return an empty findings list.

Git diff to analyze:
```diff
{diff}
```

Files changed: {files}
"""

QUALITY_AGENT_PROMPT = """You are a code quality reviewer analyzing Python code style and maintainability.

Analyze the following Git diff for code quality issues. Focus ONLY on:
- PEP 8 style violations (naming conventions, line length, whitespace)
- Missing or inadequate docstrings for public functions/classes
- Code complexity (deeply nested conditions, long functions)
- Code duplication in the diff
- Poor naming (unclear variable/function names)
- Missing type hints in function signatures
- Inconsistent patterns with the rest of the codebase
- Magic numbers (unexplained numeric constants)
- TODO/FIXME comments that should be addressed

DO NOT report:
- Security vulnerabilities (handled by security agent)
- Logic bugs (handled by logic agent)
- Issues in code that wasn't changed (only review the diff)

For each issue found, provide:
- severity: "critical" (breaks conventions severely), "warning" (should fix), "info" (nice to have)
- file_path: exact file path from the diff
- line_number: line number in the new version (lines starting with +)
- title: brief description (under 60 chars)
- description: explanation of why this is a quality issue
- suggestion: how to improve

Be conservative - only report clear issues. If code quality is acceptable, return an empty findings list.

Git diff to analyze:
```diff
{diff}
```

Files changed: {files}
"""


def format_prompt(template: str, diff: str, files: List[str] = None) -> str:
    """Format a prompt template with the given values.

    Args:
        template: Prompt template with {diff} and {files} placeholders.
        diff: Git diff content to analyze.
        files: List of changed file paths.

    Returns:
        Formatted prompt string.
    """
    files_str = ", ".join(files) if files else "unknown"
    return template.format(diff=diff, files=files_str)
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_prompts.py -v`

Expected: 6 passed

### Step 5: Update agents __init__.py

```python
# backend/app/agents/__init__.py
"""Agents module for CodeGuard AI."""

from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    format_prompt,
)
from app.agents.schemas import AgentFinding, AgentResponse, ReviewState

__all__ = [
    "AgentFinding",
    "AgentResponse",
    "ReviewState",
    "LOGIC_AGENT_PROMPT",
    "SECURITY_AGENT_PROMPT",
    "QUALITY_AGENT_PROMPT",
    "format_prompt",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 71 passed

### Step 7: Commit

```bash
git add backend/app/agents/prompts.py backend/tests/test_prompts.py backend/app/agents/__init__.py
git commit -m "feat: add prompt templates for code review agents"
```

---

## Task 4: Create Base Agent Class

**Files:**
- Create: `backend/app/agents/base.py`
- Create: `backend/tests/test_base_agent.py`
- Modify: `backend/app/agents/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_base_agent.py
"""Tests for base agent class."""

import pytest
from unittest.mock import MagicMock, patch

from app.agents.base import BaseAgent
from app.agents.schemas import AgentFinding, AgentResponse
from app.models import AgentType


class TestBaseAgent:
    """Tests for BaseAgent class."""

    def test_init_sets_agent_type(self):
        """Test that init sets agent type correctly."""
        with patch("app.agents.base.LLMService"):
            agent = BaseAgent(
                agent_type=AgentType.LOGIC,
                prompt_template="Test {diff}",
            )
            assert agent.agent_type == AgentType.LOGIC

    def test_init_sets_prompt_template(self):
        """Test that init sets prompt template."""
        with patch("app.agents.base.LLMService"):
            agent = BaseAgent(
                agent_type=AgentType.SECURITY,
                prompt_template="Analyze: {diff}",
            )
            assert agent.prompt_template == "Analyze: {diff}"

    def test_analyze_calls_llm_with_formatted_prompt(self):
        """Test that analyze formats prompt and calls LLM."""
        with patch("app.agents.base.LLMService") as mock_llm_class:
            mock_llm = MagicMock()
            mock_llm.invoke_structured.return_value = AgentResponse(
                findings=[], summary="No issues"
            )
            mock_llm_class.return_value = mock_llm

            agent = BaseAgent(
                agent_type=AgentType.QUALITY,
                prompt_template="Review: {diff}\nFiles: {files}",
            )
            result = agent.analyze(diff="+ new code", files=["test.py"])

            mock_llm.invoke_structured.assert_called_once()
            call_args = mock_llm.invoke_structured.call_args
            assert "+ new code" in call_args[0][0]
            assert "test.py" in call_args[0][0]

    def test_analyze_returns_findings(self):
        """Test that analyze returns agent findings."""
        with patch("app.agents.base.LLMService") as mock_llm_class:
            mock_llm = MagicMock()
            mock_llm.invoke_structured.return_value = AgentResponse(
                findings=[
                    AgentFinding(
                        severity="warning",
                        file_path="test.py",
                        line_number=10,
                        title="Test issue",
                        description="Description",
                    )
                ],
                summary="Found 1 issue",
            )
            mock_llm_class.return_value = mock_llm

            agent = BaseAgent(
                agent_type=AgentType.LOGIC,
                prompt_template="{diff}",
            )
            result = agent.analyze(diff="test", files=[])

            assert len(result) == 1
            assert result[0].severity == "warning"
            assert result[0].title == "Test issue"

    def test_analyze_handles_empty_response(self):
        """Test that analyze handles empty response gracefully."""
        with patch("app.agents.base.LLMService") as mock_llm_class:
            mock_llm = MagicMock()
            mock_llm.invoke_structured.return_value = AgentResponse(
                findings=[], summary="No issues"
            )
            mock_llm_class.return_value = mock_llm

            agent = BaseAgent(
                agent_type=AgentType.SECURITY,
                prompt_template="{diff}",
            )
            result = agent.analyze(diff="clean code", files=[])

            assert result == []

    def test_analyze_with_custom_llm(self):
        """Test that agent can use injected LLM service."""
        mock_llm = MagicMock()
        mock_llm.invoke_structured.return_value = AgentResponse(
            findings=[], summary="OK"
        )

        agent = BaseAgent(
            agent_type=AgentType.QUALITY,
            prompt_template="{diff}",
            llm_service=mock_llm,
        )
        agent.analyze(diff="test", files=[])

        mock_llm.invoke_structured.assert_called_once()
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_base_agent.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.base'`

### Step 3: Write minimal implementation

```python
# backend/app/agents/base.py
"""Base agent class for code review agents."""

from typing import List, Optional

from app.agents.prompts import format_prompt
from app.agents.schemas import AgentFinding, AgentResponse
from app.models import AgentType
from app.services.llm import LLMService


class BaseAgent:
    """Base class for code review agents.

    Each specialized agent (Logic, Security, Quality) inherits from this
    and provides its own prompt template and agent type.
    """

    def __init__(
        self,
        agent_type: AgentType,
        prompt_template: str,
        llm_service: Optional[LLMService] = None,
    ):
        """Initialize the agent.

        Args:
            agent_type: The type of agent (logic, security, quality).
            prompt_template: Prompt template with {diff} and {files} placeholders.
            llm_service: Optional LLM service instance. Creates one if not provided.
        """
        self.agent_type = agent_type
        self.prompt_template = prompt_template
        self.llm = llm_service or LLMService()

    def analyze(self, diff: str, files: List[str]) -> List[AgentFinding]:
        """Analyze code diff and return findings.

        Args:
            diff: Git diff content to analyze.
            files: List of changed file paths.

        Returns:
            List of findings from the analysis.
        """
        prompt = format_prompt(self.prompt_template, diff=diff, files=files)
        response = self.llm.invoke_structured(prompt, AgentResponse)
        return response.findings
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_base_agent.py -v`

Expected: 6 passed

### Step 5: Update agents __init__.py

```python
# backend/app/agents/__init__.py
"""Agents module for CodeGuard AI."""

from app.agents.base import BaseAgent
from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    format_prompt,
)
from app.agents.schemas import AgentFinding, AgentResponse, ReviewState

__all__ = [
    "AgentFinding",
    "AgentResponse",
    "ReviewState",
    "BaseAgent",
    "LOGIC_AGENT_PROMPT",
    "SECURITY_AGENT_PROMPT",
    "QUALITY_AGENT_PROMPT",
    "format_prompt",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 77 passed

### Step 7: Commit

```bash
git add backend/app/agents/base.py backend/tests/test_base_agent.py backend/app/agents/__init__.py
git commit -m "feat: add base agent class for code review"
```

---

## Task 5: Create Specialized Agents

**Files:**
- Create: `backend/app/agents/logic_agent.py`
- Create: `backend/app/agents/security_agent.py`
- Create: `backend/app/agents/quality_agent.py`
- Create: `backend/tests/test_specialized_agents.py`
- Modify: `backend/app/agents/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_specialized_agents.py
"""Tests for specialized agents."""

import pytest
from unittest.mock import MagicMock, patch

from app.agents.logic_agent import LogicAgent
from app.agents.security_agent import SecurityAgent
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, AgentResponse
from app.models import AgentType


class TestLogicAgent:
    """Tests for LogicAgent."""

    def test_has_correct_agent_type(self):
        """Test that LogicAgent has correct type."""
        with patch("app.agents.base.LLMService"):
            agent = LogicAgent()
            assert agent.agent_type == AgentType.LOGIC

    def test_uses_logic_prompt(self):
        """Test that LogicAgent uses logic prompt template."""
        with patch("app.agents.base.LLMService"):
            agent = LogicAgent()
            assert "logic" in agent.prompt_template.lower()

    def test_analyze_returns_findings(self):
        """Test LogicAgent analyze returns findings."""
        mock_llm = MagicMock()
        mock_llm.invoke_structured.return_value = AgentResponse(
            findings=[
                AgentFinding(
                    severity="warning",
                    file_path="test.py",
                    title="Null check",
                    description="Missing null check",
                )
            ],
            summary="Found issue",
        )

        agent = LogicAgent(llm_service=mock_llm)
        result = agent.analyze(diff="+ x.foo()", files=["test.py"])

        assert len(result) == 1
        assert result[0].title == "Null check"


class TestSecurityAgent:
    """Tests for SecurityAgent."""

    def test_has_correct_agent_type(self):
        """Test that SecurityAgent has correct type."""
        with patch("app.agents.base.LLMService"):
            agent = SecurityAgent()
            assert agent.agent_type == AgentType.SECURITY

    def test_uses_security_prompt(self):
        """Test that SecurityAgent uses security prompt template."""
        with patch("app.agents.base.LLMService"):
            agent = SecurityAgent()
            assert "security" in agent.prompt_template.lower()

    def test_analyze_returns_findings(self):
        """Test SecurityAgent analyze returns findings."""
        mock_llm = MagicMock()
        mock_llm.invoke_structured.return_value = AgentResponse(
            findings=[
                AgentFinding(
                    severity="critical",
                    file_path="db.py",
                    line_number=42,
                    title="SQL Injection",
                    description="User input in query",
                )
            ],
            summary="Found vulnerability",
        )

        agent = SecurityAgent(llm_service=mock_llm)
        result = agent.analyze(diff='+ query = f"SELECT * FROM {user_input}"', files=["db.py"])

        assert len(result) == 1
        assert result[0].severity == "critical"


class TestQualityAgent:
    """Tests for QualityAgent."""

    def test_has_correct_agent_type(self):
        """Test that QualityAgent has correct type."""
        with patch("app.agents.base.LLMService"):
            agent = QualityAgent()
            assert agent.agent_type == AgentType.QUALITY

    def test_uses_quality_prompt(self):
        """Test that QualityAgent uses quality prompt template."""
        with patch("app.agents.base.LLMService"):
            agent = QualityAgent()
            # Quality prompt mentions either "quality" or "style"
            prompt_lower = agent.prompt_template.lower()
            assert "quality" in prompt_lower or "style" in prompt_lower

    def test_analyze_returns_findings(self):
        """Test QualityAgent analyze returns findings."""
        mock_llm = MagicMock()
        mock_llm.invoke_structured.return_value = AgentResponse(
            findings=[
                AgentFinding(
                    severity="info",
                    file_path="utils.py",
                    title="Missing docstring",
                    description="Function lacks docstring",
                )
            ],
            summary="Style issue",
        )

        agent = QualityAgent(llm_service=mock_llm)
        result = agent.analyze(diff="+ def foo():", files=["utils.py"])

        assert len(result) == 1
        assert result[0].severity == "info"
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_specialized_agents.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.logic_agent'`

### Step 3: Write implementations

```python
# backend/app/agents/logic_agent.py
"""Logic agent for detecting logic errors in code."""

from typing import Optional

from app.agents.base import BaseAgent
from app.agents.prompts import LOGIC_AGENT_PROMPT
from app.models import AgentType
from app.services.llm import LLMService


class LogicAgent(BaseAgent):
    """Agent specialized in finding logic errors.

    Focuses on: null checks, off-by-one errors, type mismatches,
    unreachable code, incorrect error handling.
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        """Initialize LogicAgent with logic-focused prompt."""
        super().__init__(
            agent_type=AgentType.LOGIC,
            prompt_template=LOGIC_AGENT_PROMPT,
            llm_service=llm_service,
        )
```

```python
# backend/app/agents/security_agent.py
"""Security agent for detecting vulnerabilities in code."""

from typing import Optional

from app.agents.base import BaseAgent
from app.agents.prompts import SECURITY_AGENT_PROMPT
from app.models import AgentType
from app.services.llm import LLMService


class SecurityAgent(BaseAgent):
    """Agent specialized in finding security vulnerabilities.

    Focuses on: SQL injection, command injection, XSS, hardcoded secrets,
    path traversal, insecure deserialization.
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        """Initialize SecurityAgent with security-focused prompt."""
        super().__init__(
            agent_type=AgentType.SECURITY,
            prompt_template=SECURITY_AGENT_PROMPT,
            llm_service=llm_service,
        )
```

```python
# backend/app/agents/quality_agent.py
"""Quality agent for detecting code quality issues."""

from typing import Optional

from app.agents.base import BaseAgent
from app.agents.prompts import QUALITY_AGENT_PROMPT
from app.models import AgentType
from app.services.llm import LLMService


class QualityAgent(BaseAgent):
    """Agent specialized in code quality issues.

    Focuses on: PEP 8 style, complexity, naming conventions,
    missing docstrings, code duplication.
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        """Initialize QualityAgent with quality-focused prompt."""
        super().__init__(
            agent_type=AgentType.QUALITY,
            prompt_template=QUALITY_AGENT_PROMPT,
            llm_service=llm_service,
        )
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_specialized_agents.py -v`

Expected: 9 passed

### Step 5: Update agents __init__.py

```python
# backend/app/agents/__init__.py
"""Agents module for CodeGuard AI."""

from app.agents.base import BaseAgent
from app.agents.logic_agent import LogicAgent
from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    format_prompt,
)
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, AgentResponse, ReviewState
from app.agents.security_agent import SecurityAgent

__all__ = [
    "AgentFinding",
    "AgentResponse",
    "ReviewState",
    "BaseAgent",
    "LogicAgent",
    "SecurityAgent",
    "QualityAgent",
    "LOGIC_AGENT_PROMPT",
    "SECURITY_AGENT_PROMPT",
    "QUALITY_AGENT_PROMPT",
    "format_prompt",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 86 passed

### Step 7: Commit

```bash
git add backend/app/agents/logic_agent.py backend/app/agents/security_agent.py backend/app/agents/quality_agent.py backend/tests/test_specialized_agents.py backend/app/agents/__init__.py
git commit -m "feat: add specialized Logic, Security, Quality agents"
```

---

## Task 6: Create Comment Formatter

**Files:**
- Create: `backend/app/agents/formatter.py`
- Create: `backend/tests/test_formatter.py`
- Modify: `backend/app/agents/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_formatter.py
"""Tests for comment formatter."""

import pytest

from app.agents.formatter import CommentFormatter
from app.agents.schemas import AgentFinding
from app.models import AgentType


class TestCommentFormatter:
    """Tests for CommentFormatter."""

    def test_format_empty_findings(self):
        """Test formatting with no findings."""
        result = CommentFormatter.format([], [], [])

        assert "## CodeGuard AI Review" in result
        assert "No issues found" in result

    def test_format_includes_summary_counts(self):
        """Test that summary includes severity counts."""
        findings = [
            AgentFinding(
                severity="critical",
                file_path="test.py",
                title="Critical issue",
                description="Desc",
            ),
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Warning issue",
                description="Desc",
            ),
            AgentFinding(
                severity="info",
                file_path="test.py",
                title="Info issue",
                description="Desc",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        assert "1 Critical" in result or "1 critical" in result.lower()
        assert "1 Warning" in result or "1 warning" in result.lower()
        assert "1 Info" in result or "1 info" in result.lower()

    def test_format_groups_by_severity(self):
        """Test that findings are grouped by severity."""
        logic_findings = [
            AgentFinding(
                severity="critical",
                file_path="test.py",
                title="Critical logic",
                description="Desc",
            ),
        ]
        security_findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Security warning",
                description="Desc",
            ),
        ]

        result = CommentFormatter.format(logic_findings, security_findings, [])

        # Critical should appear before warning
        critical_pos = result.find("Critical")
        warning_pos = result.find("Warning")
        assert critical_pos < warning_pos

    def test_format_includes_file_and_line(self):
        """Test that file path and line number are included."""
        findings = [
            AgentFinding(
                severity="warning",
                file_path="src/main.py",
                line_number=42,
                title="Test issue",
                description="Description here",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        assert "src/main.py" in result
        assert "42" in result

    def test_format_includes_suggestion(self):
        """Test that suggestion is included when present."""
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Issue",
                description="Problem",
                suggestion="Fix it this way",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        assert "Fix it this way" in result

    def test_format_labels_agent_type(self):
        """Test that findings are labeled with agent type."""
        logic = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Logic issue",
                description="Desc",
            ),
        ]
        security = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Security issue",
                description="Desc",
            ),
        ]
        quality = [
            AgentFinding(
                severity="info",
                file_path="test.py",
                title="Quality issue",
                description="Desc",
            ),
        ]

        result = CommentFormatter.format(logic, security, quality)

        assert "Logic" in result or "logic" in result.lower()
        assert "Security" in result or "security" in result.lower()
        assert "Quality" in result or "quality" in result.lower()

    def test_format_uses_collapsible_sections(self):
        """Test that findings use collapsible details sections."""
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Issue",
                description="Long description that should be collapsible",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        assert "<details>" in result
        assert "</details>" in result
        assert "<summary>" in result

    def test_count_by_severity(self):
        """Test counting findings by severity."""
        findings = [
            AgentFinding(severity="critical", file_path="a.py", title="A", description="D"),
            AgentFinding(severity="critical", file_path="b.py", title="B", description="D"),
            AgentFinding(severity="warning", file_path="c.py", title="C", description="D"),
        ]

        counts = CommentFormatter.count_by_severity(findings)

        assert counts["critical"] == 2
        assert counts["warning"] == 1
        assert counts["info"] == 0
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_formatter.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.formatter'`

### Step 3: Write minimal implementation

```python
# backend/app/agents/formatter.py
"""Formatter for GitHub PR review comments."""

from typing import Dict, List

from app.agents.schemas import AgentFinding


class CommentFormatter:
    """Formats agent findings into GitHub markdown comments."""

    SEVERITY_EMOJI = {
        "critical": "\U0001F534",  # Red circle
        "warning": "\U0001F7E1",   # Yellow circle
        "info": "\U0001F535",      # Blue circle
    }

    SEVERITY_ORDER = ["critical", "warning", "info"]

    @classmethod
    def format(
        cls,
        logic_findings: List[AgentFinding],
        security_findings: List[AgentFinding],
        quality_findings: List[AgentFinding],
    ) -> str:
        """Format all findings into a GitHub comment.

        Args:
            logic_findings: Findings from the logic agent.
            security_findings: Findings from the security agent.
            quality_findings: Findings from the quality agent.

        Returns:
            Formatted markdown string for GitHub comment.
        """
        all_findings = logic_findings + security_findings + quality_findings

        if not all_findings:
            return cls._format_no_issues()

        # Build comment
        lines = ["## CodeGuard AI Review", ""]

        # Summary section
        lines.extend(cls._format_summary(all_findings))
        lines.append("")

        # Group findings by severity
        for severity in cls.SEVERITY_ORDER:
            severity_findings = [
                (f, cls._get_agent_type(f, logic_findings, security_findings, quality_findings))
                for f in all_findings
                if f.severity == severity
            ]
            if severity_findings:
                lines.extend(cls._format_severity_section(severity, severity_findings))
                lines.append("")

        # Footer
        lines.append("---")
        lines.append("*Automated review by CodeGuard AI*")

        return "\n".join(lines)

    @classmethod
    def _format_no_issues(cls) -> str:
        """Format comment when no issues found."""
        return """## CodeGuard AI Review

### Summary

No issues found! Your code looks good.

---
*Automated review by CodeGuard AI*"""

    @classmethod
    def _format_summary(cls, findings: List[AgentFinding]) -> List[str]:
        """Format the summary section with counts."""
        counts = cls.count_by_severity(findings)
        lines = ["### Summary", ""]

        for severity in cls.SEVERITY_ORDER:
            count = counts[severity]
            if count > 0:
                emoji = cls.SEVERITY_EMOJI[severity]
                label = severity.capitalize()
                lines.append(f"- {emoji} **{count} {label}** issue{'s' if count != 1 else ''}")

        return lines

    @classmethod
    def _format_severity_section(
        cls,
        severity: str,
        findings: List[tuple],
    ) -> List[str]:
        """Format a section for a severity level."""
        emoji = cls.SEVERITY_EMOJI[severity]
        lines = [f"### {emoji} {severity.capitalize()} Issues", ""]

        for finding, agent_type in findings:
            lines.extend(cls._format_finding(finding, agent_type))
            lines.append("")

        return lines

    @classmethod
    def _format_finding(cls, finding: AgentFinding, agent_type: str) -> List[str]:
        """Format a single finding as collapsible section."""
        location = finding.file_path
        if finding.line_number:
            location += f":{finding.line_number}"

        lines = [
            "<details>",
            f"<summary><b>{finding.title}</b> ({location}) - {agent_type}</summary>",
            "",
            f"**File:** `{finding.file_path}`",
        ]

        if finding.line_number:
            lines.append(f"**Line:** {finding.line_number}")

        lines.extend([
            f"**Agent:** {agent_type}",
            "",
            finding.description,
        ])

        if finding.suggestion:
            lines.extend([
                "",
                f"**Suggestion:** {finding.suggestion}",
            ])

        lines.append("</details>")

        return lines

    @classmethod
    def _get_agent_type(
        cls,
        finding: AgentFinding,
        logic: List[AgentFinding],
        security: List[AgentFinding],
        quality: List[AgentFinding],
    ) -> str:
        """Determine which agent produced a finding."""
        if finding in logic:
            return "Logic"
        elif finding in security:
            return "Security"
        elif finding in quality:
            return "Quality"
        return "Unknown"

    @classmethod
    def count_by_severity(cls, findings: List[AgentFinding]) -> Dict[str, int]:
        """Count findings by severity level.

        Args:
            findings: List of findings to count.

        Returns:
            Dictionary mapping severity to count.
        """
        counts = {"critical": 0, "warning": 0, "info": 0}
        for finding in findings:
            counts[finding.severity] += 1
        return counts
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_formatter.py -v`

Expected: 9 passed

### Step 5: Update agents __init__.py

```python
# backend/app/agents/__init__.py
"""Agents module for CodeGuard AI."""

from app.agents.base import BaseAgent
from app.agents.formatter import CommentFormatter
from app.agents.logic_agent import LogicAgent
from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    format_prompt,
)
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, AgentResponse, ReviewState
from app.agents.security_agent import SecurityAgent

__all__ = [
    "AgentFinding",
    "AgentResponse",
    "ReviewState",
    "BaseAgent",
    "LogicAgent",
    "SecurityAgent",
    "QualityAgent",
    "CommentFormatter",
    "LOGIC_AGENT_PROMPT",
    "SECURITY_AGENT_PROMPT",
    "QUALITY_AGENT_PROMPT",
    "format_prompt",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 95 passed

### Step 7: Commit

```bash
git add backend/app/agents/formatter.py backend/tests/test_formatter.py backend/app/agents/__init__.py
git commit -m "feat: add comment formatter for GitHub PR comments"
```

---

## Task 7: Create LangGraph Supervisor

**Files:**
- Create: `backend/app/agents/supervisor.py`
- Create: `backend/tests/test_supervisor.py`
- Modify: `backend/app/agents/__init__.py`

### Step 1: Write the failing test

```python
# backend/tests/test_supervisor.py
"""Tests for the supervisor graph."""

import pytest
from unittest.mock import MagicMock, patch

from app.agents.supervisor import ReviewSupervisor, create_review_graph
from app.agents.schemas import AgentFinding, AgentResponse, ReviewState


class TestReviewSupervisor:
    """Tests for ReviewSupervisor."""

    def test_init_creates_graph(self):
        """Test that init creates the LangGraph."""
        with patch("app.agents.supervisor.LogicAgent"), \
             patch("app.agents.supervisor.SecurityAgent"), \
             patch("app.agents.supervisor.QualityAgent"):
            supervisor = ReviewSupervisor()
            assert supervisor.graph is not None

    def test_run_returns_review_state(self):
        """Test that run returns a complete ReviewState."""
        mock_logic = MagicMock()
        mock_logic.analyze.return_value = []
        mock_security = MagicMock()
        mock_security.analyze.return_value = []
        mock_quality = MagicMock()
        mock_quality.analyze.return_value = []

        with patch("app.agents.supervisor.LogicAgent", return_value=mock_logic), \
             patch("app.agents.supervisor.SecurityAgent", return_value=mock_security), \
             patch("app.agents.supervisor.QualityAgent", return_value=mock_quality):
            supervisor = ReviewSupervisor()
            result = supervisor.run(
                pr_diff="+ new code",
                pr_files=["test.py"],
            )

            assert "logic_findings" in result
            assert "security_findings" in result
            assert "quality_findings" in result
            assert "final_comment" in result

    def test_run_calls_all_agents(self):
        """Test that run invokes all three agents."""
        mock_logic = MagicMock()
        mock_logic.analyze.return_value = []
        mock_security = MagicMock()
        mock_security.analyze.return_value = []
        mock_quality = MagicMock()
        mock_quality.analyze.return_value = []

        with patch("app.agents.supervisor.LogicAgent", return_value=mock_logic), \
             patch("app.agents.supervisor.SecurityAgent", return_value=mock_security), \
             patch("app.agents.supervisor.QualityAgent", return_value=mock_quality):
            supervisor = ReviewSupervisor()
            supervisor.run(pr_diff="test", pr_files=["test.py"])

            mock_logic.analyze.assert_called_once()
            mock_security.analyze.assert_called_once()
            mock_quality.analyze.assert_called_once()

    def test_run_collects_findings_from_all_agents(self):
        """Test that findings from all agents are collected."""
        logic_finding = AgentFinding(
            severity="warning",
            file_path="test.py",
            title="Logic issue",
            description="Desc",
        )
        security_finding = AgentFinding(
            severity="critical",
            file_path="test.py",
            title="Security issue",
            description="Desc",
        )
        quality_finding = AgentFinding(
            severity="info",
            file_path="test.py",
            title="Quality issue",
            description="Desc",
        )

        mock_logic = MagicMock()
        mock_logic.analyze.return_value = [logic_finding]
        mock_security = MagicMock()
        mock_security.analyze.return_value = [security_finding]
        mock_quality = MagicMock()
        mock_quality.analyze.return_value = [quality_finding]

        with patch("app.agents.supervisor.LogicAgent", return_value=mock_logic), \
             patch("app.agents.supervisor.SecurityAgent", return_value=mock_security), \
             patch("app.agents.supervisor.QualityAgent", return_value=mock_quality):
            supervisor = ReviewSupervisor()
            result = supervisor.run(pr_diff="test", pr_files=["test.py"])

            assert len(result["logic_findings"]) == 1
            assert len(result["security_findings"]) == 1
            assert len(result["quality_findings"]) == 1

    def test_run_generates_formatted_comment(self):
        """Test that run generates a formatted GitHub comment."""
        mock_logic = MagicMock()
        mock_logic.analyze.return_value = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                title="Test",
                description="Desc",
            )
        ]
        mock_security = MagicMock()
        mock_security.analyze.return_value = []
        mock_quality = MagicMock()
        mock_quality.analyze.return_value = []

        with patch("app.agents.supervisor.LogicAgent", return_value=mock_logic), \
             patch("app.agents.supervisor.SecurityAgent", return_value=mock_security), \
             patch("app.agents.supervisor.QualityAgent", return_value=mock_quality):
            supervisor = ReviewSupervisor()
            result = supervisor.run(pr_diff="test", pr_files=["test.py"])

            assert "## CodeGuard AI Review" in result["final_comment"]

    def test_run_with_custom_agents(self):
        """Test supervisor with injected agents."""
        mock_logic = MagicMock()
        mock_logic.analyze.return_value = []
        mock_security = MagicMock()
        mock_security.analyze.return_value = []
        mock_quality = MagicMock()
        mock_quality.analyze.return_value = []

        supervisor = ReviewSupervisor(
            logic_agent=mock_logic,
            security_agent=mock_security,
            quality_agent=mock_quality,
        )
        result = supervisor.run(pr_diff="test", pr_files=[])

        assert result is not None


class TestCreateReviewGraph:
    """Tests for create_review_graph function."""

    def test_creates_compiled_graph(self):
        """Test that create_review_graph returns a compiled graph."""
        mock_logic = MagicMock()
        mock_logic.analyze.return_value = []
        mock_security = MagicMock()
        mock_security.analyze.return_value = []
        mock_quality = MagicMock()
        mock_quality.analyze.return_value = []

        graph = create_review_graph(mock_logic, mock_security, mock_quality)

        # Graph should be invokable
        assert hasattr(graph, "invoke")
```

### Step 2: Run test to verify it fails

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_supervisor.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.supervisor'`

### Step 3: Write minimal implementation

```python
# backend/app/agents/supervisor.py
"""Supervisor agent that orchestrates parallel code review."""

from typing import List, Optional

from langgraph.graph import END, START, StateGraph

from app.agents.formatter import CommentFormatter
from app.agents.logic_agent import LogicAgent
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, ReviewState
from app.agents.security_agent import SecurityAgent


def create_review_graph(
    logic_agent: LogicAgent,
    security_agent: SecurityAgent,
    quality_agent: QualityAgent,
):
    """Create the LangGraph for parallel code review.

    Args:
        logic_agent: Agent for logic error detection.
        security_agent: Agent for security vulnerability detection.
        quality_agent: Agent for code quality issues.

    Returns:
        Compiled LangGraph ready for invocation.
    """

    def run_logic(state: ReviewState) -> dict:
        """Run logic agent and return findings."""
        findings = logic_agent.analyze(
            diff=state["pr_diff"],
            files=state["pr_files"],
        )
        return {"logic_findings": findings}

    def run_security(state: ReviewState) -> dict:
        """Run security agent and return findings."""
        findings = security_agent.analyze(
            diff=state["pr_diff"],
            files=state["pr_files"],
        )
        return {"security_findings": findings}

    def run_quality(state: ReviewState) -> dict:
        """Run quality agent and return findings."""
        findings = quality_agent.analyze(
            diff=state["pr_diff"],
            files=state["pr_files"],
        )
        return {"quality_findings": findings}

    def combine_findings(state: ReviewState) -> dict:
        """Combine all findings and format as GitHub comment."""
        comment = CommentFormatter.format(
            logic_findings=state["logic_findings"],
            security_findings=state["security_findings"],
            quality_findings=state["quality_findings"],
        )
        return {"final_comment": comment}

    # Build the graph
    graph = StateGraph(ReviewState)

    # Add nodes
    graph.add_node("logic", run_logic)
    graph.add_node("security", run_security)
    graph.add_node("quality", run_quality)
    graph.add_node("combine", combine_findings)

    # Add edges for parallel execution from START
    graph.add_edge(START, "logic")
    graph.add_edge(START, "security")
    graph.add_edge(START, "quality")

    # All agents converge to combine
    graph.add_edge("logic", "combine")
    graph.add_edge("security", "combine")
    graph.add_edge("quality", "combine")

    # Combine leads to END
    graph.add_edge("combine", END)

    return graph.compile()


class ReviewSupervisor:
    """Supervisor that orchestrates parallel code review agents.

    Uses LangGraph to run Logic, Security, and Quality agents in parallel,
    then combines their findings into a formatted GitHub comment.
    """

    def __init__(
        self,
        logic_agent: Optional[LogicAgent] = None,
        security_agent: Optional[SecurityAgent] = None,
        quality_agent: Optional[QualityAgent] = None,
    ):
        """Initialize the supervisor with agents.

        Args:
            logic_agent: Optional LogicAgent instance.
            security_agent: Optional SecurityAgent instance.
            quality_agent: Optional QualityAgent instance.
        """
        self.logic_agent = logic_agent or LogicAgent()
        self.security_agent = security_agent or SecurityAgent()
        self.quality_agent = quality_agent or QualityAgent()

        self.graph = create_review_graph(
            self.logic_agent,
            self.security_agent,
            self.quality_agent,
        )

    def run(self, pr_diff: str, pr_files: List[str]) -> ReviewState:
        """Run the review pipeline on a PR.

        Args:
            pr_diff: Git diff content to analyze.
            pr_files: List of changed file paths.

        Returns:
            ReviewState with all findings and formatted comment.
        """
        initial_state: ReviewState = {
            "pr_diff": pr_diff,
            "pr_files": pr_files,
            "logic_findings": [],
            "security_findings": [],
            "quality_findings": [],
            "final_comment": "",
        }

        result = self.graph.invoke(initial_state)
        return result
```

### Step 4: Run test to verify it passes

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/test_supervisor.py -v`

Expected: 7 passed

### Step 5: Update agents __init__.py

```python
# backend/app/agents/__init__.py
"""Agents module for CodeGuard AI."""

from app.agents.base import BaseAgent
from app.agents.formatter import CommentFormatter
from app.agents.logic_agent import LogicAgent
from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    format_prompt,
)
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, AgentResponse, ReviewState
from app.agents.security_agent import SecurityAgent
from app.agents.supervisor import ReviewSupervisor, create_review_graph

__all__ = [
    "AgentFinding",
    "AgentResponse",
    "ReviewState",
    "BaseAgent",
    "LogicAgent",
    "SecurityAgent",
    "QualityAgent",
    "CommentFormatter",
    "ReviewSupervisor",
    "create_review_graph",
    "LOGIC_AGENT_PROMPT",
    "SECURITY_AGENT_PROMPT",
    "QUALITY_AGENT_PROMPT",
    "format_prompt",
]
```

### Step 6: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 102 passed

### Step 7: Commit

```bash
git add backend/app/agents/supervisor.py backend/tests/test_supervisor.py backend/app/agents/__init__.py
git commit -m "feat: add LangGraph supervisor for parallel agent execution"
```

---

## Task 8: Add Supervisor Dependency Injection

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`

### Step 1: Update main.py with supervisor dependency

```python
# Add to backend/app/main.py after existing imports and dependencies

from app.agents import ReviewSupervisor


def get_review_supervisor() -> ReviewSupervisor:
    """Get ReviewSupervisor instance for dependency injection."""
    return ReviewSupervisor()
```

### Step 2: Update conftest.py with mock supervisor

```python
# Add to backend/tests/conftest.py

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
```

### Step 3: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 102 passed

### Step 4: Verify server starts

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -c "from app.main import app, get_review_supervisor; print('OK')"`

Expected: `OK`

### Step 5: Commit

```bash
git add backend/app/main.py backend/tests/conftest.py
git commit -m "feat: add ReviewSupervisor dependency injection"
```

---

## Task 9: Verify Full Integration

### Step 1: Run all tests

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -m pytest tests/ -v`

Expected: 102 passed

### Step 2: Verify imports work

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -c "from app.agents import ReviewSupervisor, LogicAgent, SecurityAgent, QualityAgent, CommentFormatter; print('All imports OK')"`

Expected: `All imports OK`

### Step 3: Verify server starts

Run: `cd "C:\Ammar work\AI-code-review-assistant\backend" && python -c "from app.main import app; print('Routes:', [r.path for r in app.routes])"`

Expected: Should show all routes including `/api/webhook/github`

### Step 4: Commit final integration

```bash
git add .
git commit -m "feat: complete Phase 3 - LangGraph agent framework"
```

---

## Summary

After completing all tasks, you will have:

1. **LLM Service** (`services/llm.py`) - Gemini integration with structured output support
2. **Agent Schemas** (`agents/schemas.py`) - Pydantic models for agent I/O
3. **Prompt Templates** (`agents/prompts.py`) - Specialized prompts for each agent
4. **Base Agent** (`agents/base.py`) - Common agent functionality
5. **Specialized Agents** - Logic, Security, Quality agents
6. **Comment Formatter** (`agents/formatter.py`) - GitHub markdown formatting
7. **LangGraph Supervisor** (`agents/supervisor.py`) - Parallel execution orchestration
8. **Dependency Injection** - FastAPI integration for supervisor

**Test count:** ~102 tests (54 existing + ~48 new)

**Files created:**
- `backend/app/services/llm.py`
- `backend/app/agents/schemas.py`
- `backend/app/agents/prompts.py`
- `backend/app/agents/base.py`
- `backend/app/agents/logic_agent.py`
- `backend/app/agents/security_agent.py`
- `backend/app/agents/quality_agent.py`
- `backend/app/agents/formatter.py`
- `backend/app/agents/supervisor.py`
- `backend/tests/test_llm_service.py`
- `backend/tests/test_agent_schemas.py`
- `backend/tests/test_prompts.py`
- `backend/tests/test_base_agent.py`
- `backend/tests/test_specialized_agents.py`
- `backend/tests/test_formatter.py`
- `backend/tests/test_supervisor.py`
