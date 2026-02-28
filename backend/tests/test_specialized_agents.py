"""Tests for specialized agent classes (LogicAgent, SecurityAgent, QualityAgent)."""

from unittest.mock import MagicMock, patch

import pytest

from app.agents import LogicAgent, QualityAgent, SecurityAgent
from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
)
from app.agents.schemas import AgentFinding, AgentResponse
from app.models import AgentType


class TestLogicAgent:
    """Tests for LogicAgent."""

    @patch("app.agents.base.LLMService")
    def test_has_correct_agent_type(self, mock_llm_class):
        """Test that LogicAgent has AgentType.LOGIC."""
        agent = LogicAgent()
        assert agent.agent_type == AgentType.LOGIC

    @patch("app.agents.base.LLMService")
    def test_uses_correct_prompt(self, mock_llm_class):
        """Test that LogicAgent uses LOGIC_AGENT_PROMPT."""
        agent = LogicAgent()
        assert agent.prompt_template == LOGIC_AGENT_PROMPT
        assert "Logic Agent" in agent.prompt_template
        assert "logic errors" in agent.prompt_template.lower()

    @patch("app.agents.base.LLMService")
    def test_analyze_returns_findings(self, mock_llm_class):
        """Test that LogicAgent.analyze returns findings from LLM."""
        mock_llm = MagicMock()
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                line_number=10,
                title="Null check missing",
                description="Missing None check before method call",
                suggestion="Add if obj is not None check",
            ),
        ]
        mock_response = AgentResponse(findings=findings, summary="Found 1 logic issue")
        mock_llm.invoke_structured.return_value = mock_response
        mock_llm_class.return_value = mock_llm

        agent = LogicAgent()
        result = agent.analyze(diff="+ obj.method()", files=["test.py"])

        assert result == findings
        assert len(result) == 1
        assert result[0].title == "Null check missing"
        mock_llm.invoke_structured.assert_called_once()


class TestSecurityAgent:
    """Tests for SecurityAgent."""

    @patch("app.agents.base.LLMService")
    def test_has_correct_agent_type(self, mock_llm_class):
        """Test that SecurityAgent has AgentType.SECURITY."""
        agent = SecurityAgent()
        assert agent.agent_type == AgentType.SECURITY

    @patch("app.agents.base.LLMService")
    def test_uses_correct_prompt(self, mock_llm_class):
        """Test that SecurityAgent uses SECURITY_AGENT_PROMPT."""
        agent = SecurityAgent()
        assert agent.prompt_template == SECURITY_AGENT_PROMPT
        assert "Security Agent" in agent.prompt_template
        assert "security vulnerabilities" in agent.prompt_template.lower()

    @patch("app.agents.base.LLMService")
    def test_analyze_returns_findings(self, mock_llm_class):
        """Test that SecurityAgent.analyze returns findings from LLM."""
        mock_llm = MagicMock()
        findings = [
            AgentFinding(
                severity="critical",
                file_path="app.py",
                line_number=25,
                title="SQL Injection",
                description="User input directly concatenated into SQL query",
                suggestion="Use parameterized queries",
            ),
        ]
        mock_response = AgentResponse(findings=findings, summary="Found 1 security vulnerability")
        mock_llm.invoke_structured.return_value = mock_response
        mock_llm_class.return_value = mock_llm

        agent = SecurityAgent()
        result = agent.analyze(
            diff="+ query = f\"SELECT * FROM users WHERE id = {user_id}\"",
            files=["app.py"],
        )

        assert result == findings
        assert len(result) == 1
        assert result[0].severity == "critical"
        assert result[0].title == "SQL Injection"
        mock_llm.invoke_structured.assert_called_once()


class TestQualityAgent:
    """Tests for QualityAgent."""

    @patch("app.agents.base.LLMService")
    def test_has_correct_agent_type(self, mock_llm_class):
        """Test that QualityAgent has AgentType.QUALITY."""
        agent = QualityAgent()
        assert agent.agent_type == AgentType.QUALITY

    @patch("app.agents.base.LLMService")
    def test_uses_correct_prompt(self, mock_llm_class):
        """Test that QualityAgent uses QUALITY_AGENT_PROMPT."""
        agent = QualityAgent()
        assert agent.prompt_template == QUALITY_AGENT_PROMPT
        assert "Quality Agent" in agent.prompt_template
        assert "code quality" in agent.prompt_template.lower()

    @patch("app.agents.base.LLMService")
    def test_analyze_returns_findings(self, mock_llm_class):
        """Test that QualityAgent.analyze returns findings from LLM."""
        mock_llm = MagicMock()
        findings = [
            AgentFinding(
                severity="warning",
                file_path="utils.py",
                line_number=15,
                title="Missing docstring",
                description="Public function lacks docstring",
                suggestion="Add docstring describing function purpose and parameters",
            ),
        ]
        mock_response = AgentResponse(findings=findings, summary="Found 1 quality issue")
        mock_llm.invoke_structured.return_value = mock_response
        mock_llm_class.return_value = mock_llm

        agent = QualityAgent()
        result = agent.analyze(
            diff="+ def process_data(items):\n+     return [x * 2 for x in items]",
            files=["utils.py"],
        )

        assert result == findings
        assert len(result) == 1
        assert result[0].severity == "warning"
        assert result[0].title == "Missing docstring"
        mock_llm.invoke_structured.assert_called_once()
