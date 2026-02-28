"""Tests for agent schemas."""

import pytest
from pydantic import ValidationError

from app.agents.schemas import AgentFinding, AgentResponse, ReviewState, CritiqueResponse


class TestAgentFinding:
    """Tests for AgentFinding schema."""

    def test_create_valid_finding(self):
        """Test creating a valid finding with all fields."""
        finding = AgentFinding(
            severity="critical",
            file_path="src/main.py",
            line_number=42,
            title="SQL Injection Vulnerability",
            description="User input is directly concatenated into SQL query.",
            suggestion="Use parameterized queries instead.",
        )

        assert finding.severity == "critical"
        assert finding.file_path == "src/main.py"
        assert finding.line_number == 42
        assert finding.title == "SQL Injection Vulnerability"
        assert finding.description == "User input is directly concatenated into SQL query."
        assert finding.suggestion == "Use parameterized queries instead."

    def test_create_finding_without_line_number(self):
        """Test creating a finding without optional line_number."""
        finding = AgentFinding(
            severity="warning",
            file_path="utils/helper.py",
            title="Missing Error Handling",
            description="Function does not handle potential exceptions.",
        )

        assert finding.severity == "warning"
        assert finding.file_path == "utils/helper.py"
        assert finding.line_number is None
        assert finding.title == "Missing Error Handling"
        assert finding.suggestion is None

    def test_invalid_severity_raises(self):
        """Test that invalid severity raises ValidationError."""
        with pytest.raises(ValidationError):
            AgentFinding(
                severity="high",  # Invalid severity
                file_path="src/main.py",
                title="Test Finding",
                description="Test description",
            )


class TestAgentResponse:
    """Tests for AgentResponse schema."""

    def test_create_response_with_findings(self):
        """Test creating a response with findings."""
        finding1 = AgentFinding(
            severity="critical",
            file_path="src/main.py",
            line_number=10,
            title="Critical Issue",
            description="Critical issue description",
        )
        finding2 = AgentFinding(
            severity="info",
            file_path="src/utils.py",
            line_number=20,
            title="Info Issue",
            description="Info issue description",
        )

        response = AgentResponse(
            findings=[finding1, finding2],
            summary="Found 2 issues in the code.",
        )

        assert len(response.findings) == 2
        assert response.findings[0].severity == "critical"
        assert response.findings[1].severity == "info"
        assert response.summary == "Found 2 issues in the code."

    def test_create_empty_response(self):
        """Test creating a response with no findings."""
        response = AgentResponse(summary="No issues found.")

        assert response.findings == []
        assert response.summary == "No issues found."


class TestReviewState:
    """Tests for ReviewState TypedDict."""

    def test_create_initial_state(self):
        """Test creating an initial review state."""
        state: ReviewState = {
            "pr_diff": "diff --git a/main.py b/main.py\n+print('hello')",
            "pr_files": ["main.py", "utils.py"],
            "logic_findings": [],
            "security_findings": [],
            "quality_findings": [],
            "final_comment": "",
        }

        assert state["pr_diff"].startswith("diff --git")
        assert len(state["pr_files"]) == 2
        assert state["logic_findings"] == []
        assert state["security_findings"] == []
        assert state["quality_findings"] == []
        assert state["final_comment"] == ""


class TestConfidenceField:
    """Tests for confidence field in AgentFinding."""

    def test_agent_finding_has_confidence_field(self):
        """Test AgentFinding includes confidence field."""
        finding = AgentFinding(
            severity="warning",
            confidence="high",
            file_path="test.py",
            title="Test Issue",
            description="Test description",
        )
        assert finding.confidence == "high"

    def test_agent_finding_confidence_defaults_to_medium(self):
        """Test AgentFinding confidence defaults to medium."""
        finding = AgentFinding(
            severity="warning",
            file_path="test.py",
            title="Test Issue",
            description="Test description",
        )
        assert finding.confidence == "medium"


class TestCritiqueResponse:
    """Tests for CritiqueResponse schema."""

    def test_critique_response_schema(self):
        """Test CritiqueResponse schema."""
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
        assert response.misattributions_fixed == 1
        assert response.summary == "Cleaned findings"
