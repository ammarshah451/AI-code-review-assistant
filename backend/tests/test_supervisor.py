"""Tests for ReviewSupervisor and create_review_graph."""

from unittest.mock import MagicMock, patch

import pytest

from app.agents.critique import CritiqueAgent
from app.agents.formatter import CommentFormatter
from app.agents.logic_agent import LogicAgent
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, CritiqueResponse, ReviewState
from app.agents.security_agent import SecurityAgent
from app.agents.supervisor import ReviewSupervisor, create_review_graph


class TestCreateReviewGraph:
    """Tests for create_review_graph function."""

    def test_create_review_graph_returns_compiled_graph(self):
        """Test that create_review_graph returns a compiled LangGraph."""
        mock_logic = MagicMock(spec=LogicAgent)
        mock_security = MagicMock(spec=SecurityAgent)
        mock_quality = MagicMock(spec=QualityAgent)
        mock_critique = MagicMock(spec=CritiqueAgent)

        graph = create_review_graph(mock_logic, mock_security, mock_quality, mock_critique)

        # Check that the graph is a CompiledGraph (has invoke method)
        assert hasattr(graph, "invoke")
        assert callable(graph.invoke)


class TestReviewSupervisor:
    """Tests for ReviewSupervisor class."""

    @patch("app.agents.supervisor.LogicAgent")
    @patch("app.agents.supervisor.SecurityAgent")
    @patch("app.agents.supervisor.QualityAgent")
    @patch("app.agents.supervisor.CritiqueAgent")
    def test_init_creates_graph(
        self, mock_critique_class, mock_quality_class, mock_security_class, mock_logic_class
    ):
        """Test that ReviewSupervisor initializes with a compiled graph."""
        supervisor = ReviewSupervisor()

        # Check that agents were created
        mock_logic_class.assert_called_once()
        mock_security_class.assert_called_once()
        mock_quality_class.assert_called_once()
        mock_critique_class.assert_called_once()

        # Check that graph was created
        assert supervisor.graph is not None
        assert hasattr(supervisor.graph, "invoke")

    @patch("app.agents.supervisor.LogicAgent")
    @patch("app.agents.supervisor.SecurityAgent")
    @patch("app.agents.supervisor.QualityAgent")
    @patch("app.agents.supervisor.CritiqueAgent")
    def test_run_returns_review_state(
        self, mock_critique_class, mock_quality_class, mock_security_class, mock_logic_class
    ):
        """Test that run returns a ReviewState dictionary."""
        # Setup mock agents to return empty findings
        mock_logic_class.return_value.analyze.return_value = []
        mock_security_class.return_value.analyze.return_value = []
        mock_quality_class.return_value.analyze.return_value = []

        # Setup critique agent to return empty findings
        mock_critique_response = MagicMock()
        mock_critique_response.logic_findings = []
        mock_critique_response.security_findings = []
        mock_critique_response.quality_findings = []
        mock_critique_class.return_value.critique.return_value = mock_critique_response

        supervisor = ReviewSupervisor()
        result = supervisor.run(pr_diff="+ test code", pr_files=["test.py"])

        # Check that result is a ReviewState with all expected keys
        assert "pr_diff" in result
        assert "pr_files" in result
        assert "logic_findings" in result
        assert "security_findings" in result
        assert "quality_findings" in result
        assert "final_comment" in result

    @patch("app.agents.supervisor.LogicAgent")
    @patch("app.agents.supervisor.SecurityAgent")
    @patch("app.agents.supervisor.QualityAgent")
    @patch("app.agents.supervisor.CritiqueAgent")
    def test_run_calls_all_agents(
        self, mock_critique_class, mock_quality_class, mock_security_class, mock_logic_class
    ):
        """Test that run invokes analyze on all three agents."""
        mock_logic = MagicMock()
        mock_security = MagicMock()
        mock_quality = MagicMock()
        mock_critique = MagicMock()

        mock_logic.analyze.return_value = []
        mock_security.analyze.return_value = []
        mock_quality.analyze.return_value = []

        mock_critique_response = MagicMock()
        mock_critique_response.logic_findings = []
        mock_critique_response.security_findings = []
        mock_critique_response.quality_findings = []
        mock_critique.critique.return_value = mock_critique_response

        mock_logic_class.return_value = mock_logic
        mock_security_class.return_value = mock_security
        mock_quality_class.return_value = mock_quality
        mock_critique_class.return_value = mock_critique

        supervisor = ReviewSupervisor()
        supervisor.run(pr_diff="+ test code", pr_files=["test.py"])

        # Verify all agents were called
        mock_logic.analyze.assert_called_once_with("+ test code", ["test.py"])
        mock_security.analyze.assert_called_once_with("+ test code", ["test.py"])
        mock_quality.analyze.assert_called_once_with("+ test code", ["test.py"])
        mock_critique.critique.assert_called_once()

    @patch("app.agents.supervisor.LogicAgent")
    @patch("app.agents.supervisor.SecurityAgent")
    @patch("app.agents.supervisor.QualityAgent")
    @patch("app.agents.supervisor.CritiqueAgent")
    def test_run_collects_findings_from_all_agents(
        self, mock_critique_class, mock_quality_class, mock_security_class, mock_logic_class
    ):
        """Test that run collects and returns findings from all agents."""
        # Create mock findings for each agent
        logic_finding = AgentFinding(
            severity="warning",
            file_path="test.py",
            line_number=10,
            title="Logic Error",
            description="Missing null check",
        )
        security_finding = AgentFinding(
            severity="critical",
            file_path="app.py",
            line_number=25,
            title="SQL Injection",
            description="User input in query",
        )
        quality_finding = AgentFinding(
            severity="info",
            file_path="utils.py",
            line_number=5,
            title="Missing Docstring",
            description="Function lacks documentation",
        )

        mock_logic_class.return_value.analyze.return_value = [logic_finding]
        mock_security_class.return_value.analyze.return_value = [security_finding]
        mock_quality_class.return_value.analyze.return_value = [quality_finding]

        # Critique agent passes through findings
        mock_critique_response = MagicMock()
        mock_critique_response.logic_findings = [logic_finding]
        mock_critique_response.security_findings = [security_finding]
        mock_critique_response.quality_findings = [quality_finding]
        mock_critique_class.return_value.critique.return_value = mock_critique_response

        supervisor = ReviewSupervisor()
        result = supervisor.run(pr_diff="+ test code", pr_files=["test.py"])

        # Check that findings were collected
        assert len(result["logic_findings"]) == 1
        assert result["logic_findings"][0].title == "Logic Error"

        assert len(result["security_findings"]) == 1
        assert result["security_findings"][0].title == "SQL Injection"

        assert len(result["quality_findings"]) == 1
        assert result["quality_findings"][0].title == "Missing Docstring"

    @patch("app.agents.supervisor.LogicAgent")
    @patch("app.agents.supervisor.SecurityAgent")
    @patch("app.agents.supervisor.QualityAgent")
    @patch("app.agents.supervisor.CritiqueAgent")
    def test_run_generates_formatted_comment(
        self, mock_critique_class, mock_quality_class, mock_security_class, mock_logic_class
    ):
        """Test that run generates a formatted GitHub comment."""
        # Create mock findings
        logic_finding = AgentFinding(
            severity="warning",
            file_path="test.py",
            line_number=10,
            title="Logic Error",
            description="Missing null check",
        )

        mock_logic_class.return_value.analyze.return_value = [logic_finding]
        mock_security_class.return_value.analyze.return_value = []
        mock_quality_class.return_value.analyze.return_value = []

        # Critique agent passes through findings
        mock_critique_response = MagicMock()
        mock_critique_response.logic_findings = [logic_finding]
        mock_critique_response.security_findings = []
        mock_critique_response.quality_findings = []
        mock_critique_class.return_value.critique.return_value = mock_critique_response

        supervisor = ReviewSupervisor()
        result = supervisor.run(pr_diff="+ test code", pr_files=["test.py"])

        # Check that final_comment is populated and contains expected content
        assert result["final_comment"] != ""
        assert "CodeGuard AI Review" in result["final_comment"]
        assert "Logic Error" in result["final_comment"]

    def test_run_with_custom_agents(self):
        """Test that ReviewSupervisor works with injected agents."""
        # Create mock agents
        mock_logic = MagicMock(spec=LogicAgent)
        mock_security = MagicMock(spec=SecurityAgent)
        mock_quality = MagicMock(spec=QualityAgent)
        mock_critique = MagicMock(spec=CritiqueAgent)

        # Setup mock return values
        logic_finding = AgentFinding(
            severity="warning",
            file_path="custom.py",
            line_number=1,
            title="Custom Logic Issue",
            description="Found by custom agent",
        )
        mock_logic.analyze.return_value = [logic_finding]
        mock_security.analyze.return_value = []
        mock_quality.analyze.return_value = []

        # Critique agent passes through findings
        mock_critique_response = MagicMock()
        mock_critique_response.logic_findings = [logic_finding]
        mock_critique_response.security_findings = []
        mock_critique_response.quality_findings = []
        mock_critique.critique.return_value = mock_critique_response

        # Create supervisor with custom agents
        supervisor = ReviewSupervisor(
            logic_agent=mock_logic,
            security_agent=mock_security,
            quality_agent=mock_quality,
            critique_agent=mock_critique,
        )

        # Verify custom agents were used
        assert supervisor.logic_agent is mock_logic
        assert supervisor.security_agent is mock_security
        assert supervisor.quality_agent is mock_quality
        assert supervisor.critique_agent is mock_critique

        # Run and verify
        result = supervisor.run(pr_diff="+ custom code", pr_files=["custom.py"])

        mock_logic.analyze.assert_called_once()
        mock_security.analyze.assert_called_once()
        mock_quality.analyze.assert_called_once()
        mock_critique.critique.assert_called_once()

        assert len(result["logic_findings"]) == 1
        assert result["logic_findings"][0].title == "Custom Logic Issue"


class TestCritiqueIntegration:
    """Tests for Critique Agent integration in supervisor."""

    def test_supervisor_runs_critique_agent(self):
        """Test that supervisor runs critique agent after other agents."""
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
