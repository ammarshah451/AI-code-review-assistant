"""Tests for BaseAgent class."""

from unittest.mock import MagicMock, patch

import pytest

from app.agents.base import BaseAgent
from app.agents.schemas import AgentFinding, AgentResponse
from app.models import AgentType


class TestBaseAgent:
    """Tests for BaseAgent."""

    @patch("app.agents.base.LLMService")
    def test_init_sets_agent_type(self, mock_llm_class):
        """Test that init sets agent_type correctly."""
        agent = BaseAgent(
            agent_type=AgentType.LOGIC,
            prompt_template="Test prompt {diff} {files}",
        )
        assert agent.agent_type == AgentType.LOGIC

    @patch("app.agents.base.LLMService")
    def test_init_sets_prompt_template(self, mock_llm_class):
        """Test that init sets prompt_template correctly."""
        template = "Analyze this code:\n{diff}\n\nFiles: {files}"
        agent = BaseAgent(
            agent_type=AgentType.SECURITY,
            prompt_template=template,
        )
        assert agent.prompt_template == template

    @patch("app.agents.base.LLMService")
    def test_analyze_calls_llm_with_formatted_prompt(self, mock_llm_class):
        """Test that analyze calls LLM with properly formatted prompt."""
        mock_llm = MagicMock()
        mock_response = AgentResponse(findings=[], summary="No issues found")
        mock_llm.invoke_structured.return_value = mock_response
        mock_llm_class.return_value = mock_llm

        template = "Review this diff:\n{diff}\n\nChanged files: {files}"
        agent = BaseAgent(
            agent_type=AgentType.QUALITY,
            prompt_template=template,
        )

        agent.analyze(diff="+ new code", files=["file1.py", "file2.py"])

        expected_prompt = "Review this diff:\n+ new code\n\nChanged files: file1.py, file2.py"
        mock_llm.invoke_structured.assert_called_once_with(
            expected_prompt, AgentResponse
        )

    @patch("app.agents.base.LLMService")
    def test_analyze_returns_findings(self, mock_llm_class):
        """Test that analyze returns list of findings from response."""
        mock_llm = MagicMock()
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                line_number=10,
                title="Test issue",
                description="A test finding",
                suggestion="Fix it",
            ),
            AgentFinding(
                severity="info",
                file_path="test2.py",
                line_number=20,
                title="Another issue",
                description="Another finding",
                suggestion=None,
            ),
        ]
        mock_response = AgentResponse(findings=findings, summary="Found 2 issues")
        mock_llm.invoke_structured.return_value = mock_response
        mock_llm_class.return_value = mock_llm

        agent = BaseAgent(
            agent_type=AgentType.LOGIC,
            prompt_template="{diff} {files}",
        )

        result = agent.analyze(diff="test diff", files=["test.py"])

        assert result == findings
        assert len(result) == 2
        assert result[0].title == "Test issue"
        assert result[1].title == "Another issue"

    @patch("app.agents.base.LLMService")
    def test_analyze_handles_empty_response(self, mock_llm_class):
        """Test that analyze handles empty findings list."""
        mock_llm = MagicMock()
        mock_response = AgentResponse(findings=[], summary="No issues found")
        mock_llm.invoke_structured.return_value = mock_response
        mock_llm_class.return_value = mock_llm

        agent = BaseAgent(
            agent_type=AgentType.SECURITY,
            prompt_template="{diff} {files}",
        )

        result = agent.analyze(diff="clean code", files=["clean.py"])

        assert result == []
        assert len(result) == 0

    def test_analyze_with_custom_llm(self):
        """Test that analyze works with injected LLM service (dependency injection)."""
        mock_llm = MagicMock()
        findings = [
            AgentFinding(
                severity="critical",
                file_path="vuln.py",
                line_number=5,
                title="SQL Injection",
                description="Unsanitized input",
                suggestion="Use parameterized queries",
            ),
        ]
        mock_response = AgentResponse(findings=findings, summary="Found critical issue")
        mock_llm.invoke_structured.return_value = mock_response

        # Pass custom LLM service directly
        agent = BaseAgent(
            agent_type=AgentType.SECURITY,
            prompt_template="Security review: {diff}\nFiles: {files}",
            llm_service=mock_llm,
        )

        result = agent.analyze(diff="user_input = request.args['id']", files=["vuln.py"])

        assert len(result) == 1
        assert result[0].severity == "critical"
        assert result[0].title == "SQL Injection"
        mock_llm.invoke_structured.assert_called_once()
