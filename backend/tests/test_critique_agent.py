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
