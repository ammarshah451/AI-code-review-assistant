"""Tests for the CommentFormatter class."""

import pytest

from app.agents.formatter import CommentFormatter
from app.agents.schemas import AgentFinding


class TestCommentFormatter:
    """Tests for CommentFormatter."""

    def test_format_empty_findings(self):
        """Test that empty findings returns success message."""
        result = CommentFormatter.format([], [], [])

        assert "No issues found!" in result
        assert "Your code looks good" in result
        assert "CodeGuard AI Review" in result
        assert "Automated review by CodeGuard AI" in result

    def test_format_includes_summary_counts(self):
        """Test that summary includes correct counts for each severity."""
        logic_findings = [
            AgentFinding(
                severity="critical",
                file_path="test.py",
                line_number=10,
                title="Critical Bug",
                description="A critical bug",
            ),
            AgentFinding(
                severity="critical",
                file_path="test.py",
                line_number=20,
                title="Another Critical",
                description="Another critical bug",
            ),
        ]
        security_findings = [
            AgentFinding(
                severity="warning",
                file_path="auth.py",
                line_number=5,
                title="Weak Auth",
                description="Weak authentication",
            ),
            AgentFinding(
                severity="warning",
                file_path="auth.py",
                line_number=15,
                title="Missing Validation",
                description="Missing input validation",
            ),
            AgentFinding(
                severity="warning",
                file_path="auth.py",
                line_number=25,
                title="Another Warning",
                description="Another warning",
            ),
        ]
        quality_findings = [
            AgentFinding(
                severity="info",
                file_path="utils.py",
                line_number=1,
                title="Style Issue",
                description="Style issue",
            ),
        ]

        result = CommentFormatter.format(
            logic_findings, security_findings, quality_findings
        )

        # Check summary section
        assert "### Summary" in result
        assert "**2 Critical**" in result
        assert "**3 Warning**" in result
        assert "**1 Info**" in result
        # Check emojis
        assert "\U0001F534" in result  # Red circle for critical
        assert "\U0001F7E1" in result  # Yellow circle for warning
        assert "\U0001F535" in result  # Blue circle for info

    def test_format_groups_by_severity(self):
        """Test that findings are grouped by severity in correct order."""
        findings = [
            AgentFinding(
                severity="info",
                file_path="a.py",
                line_number=1,
                title="Info First",
                description="An info finding",
            ),
            AgentFinding(
                severity="critical",
                file_path="b.py",
                line_number=2,
                title="Critical Second",
                description="A critical finding",
            ),
            AgentFinding(
                severity="warning",
                file_path="c.py",
                line_number=3,
                title="Warning Third",
                description="A warning finding",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        # Critical should appear before Warning, which should appear before Info
        critical_pos = result.find("Critical Issues")
        warning_pos = result.find("Warning Issues")
        info_pos = result.find("Info Issues")

        assert critical_pos < warning_pos < info_pos
        assert critical_pos != -1
        assert warning_pos != -1
        assert info_pos != -1

    def test_format_includes_file_and_line(self):
        """Test that file path and line number are included in output."""
        findings = [
            AgentFinding(
                severity="critical",
                file_path="src/db.py",
                line_number=42,
                title="SQL Injection",
                description="SQL injection vulnerability",
            ),
        ]

        result = CommentFormatter.format([], findings, [])

        assert "src/db.py" in result
        assert "42" in result
        assert "`src/db.py`" in result
        assert "**Line:** 42" in result
        assert "(src/db.py:42)" in result

    def test_format_includes_suggestion(self):
        """Test that suggestion is included when present."""
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                line_number=10,
                title="Issue with Suggestion",
                description="Description of the issue",
                suggestion="Use parameterized queries instead",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        assert "**Suggestion:**" in result
        assert "Use parameterized queries instead" in result

    def test_format_without_suggestion(self):
        """Test that suggestion section is not included when not present."""
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                line_number=10,
                title="Issue without Suggestion",
                description="Description of the issue",
                suggestion=None,
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        # The word Suggestion should not appear since there's no suggestion
        assert "**Suggestion:**" not in result

    def test_format_labels_agent_type(self):
        """Test that findings are labeled with their agent type."""
        logic_findings = [
            AgentFinding(
                severity="critical",
                file_path="logic.py",
                line_number=1,
                title="Logic Error",
                description="A logic error",
            ),
        ]
        security_findings = [
            AgentFinding(
                severity="critical",
                file_path="security.py",
                line_number=2,
                title="Security Issue",
                description="A security issue",
            ),
        ]
        quality_findings = [
            AgentFinding(
                severity="info",
                file_path="quality.py",
                line_number=3,
                title="Quality Issue",
                description="A quality issue",
            ),
        ]

        result = CommentFormatter.format(
            logic_findings, security_findings, quality_findings
        )

        # Check agent labels appear
        assert "- Logic" in result or "**Agent:** Logic" in result
        assert "- Security" in result or "**Agent:** Security" in result
        assert "- Quality" in result or "**Agent:** Quality" in result

    def test_format_uses_collapsible_sections(self):
        """Test that collapsible sections are used for findings."""
        findings = [
            AgentFinding(
                severity="warning",
                file_path="test.py",
                line_number=10,
                title="Test Issue",
                description="A test issue",
            ),
        ]

        result = CommentFormatter.format(findings, [], [])

        assert "<details>" in result
        assert "</details>" in result
        assert "<summary>" in result
        assert "</summary>" in result

    def test_count_by_severity(self):
        """Test counting findings by severity level."""
        findings = [
            AgentFinding(
                severity="critical",
                file_path="a.py",
                line_number=1,
                title="C1",
                description="Critical 1",
            ),
            AgentFinding(
                severity="critical",
                file_path="b.py",
                line_number=2,
                title="C2",
                description="Critical 2",
            ),
            AgentFinding(
                severity="warning",
                file_path="c.py",
                line_number=3,
                title="W1",
                description="Warning 1",
            ),
            AgentFinding(
                severity="info",
                file_path="d.py",
                line_number=4,
                title="I1",
                description="Info 1",
            ),
            AgentFinding(
                severity="info",
                file_path="e.py",
                line_number=5,
                title="I2",
                description="Info 2",
            ),
            AgentFinding(
                severity="info",
                file_path="f.py",
                line_number=6,
                title="I3",
                description="Info 3",
            ),
        ]

        counts = CommentFormatter.count_by_severity(findings)

        assert counts["critical"] == 2
        assert counts["warning"] == 1
        assert counts["info"] == 3

    def test_count_by_severity_empty(self):
        """Test counting with empty findings list."""
        counts = CommentFormatter.count_by_severity([])

        assert counts == {}

    def test_format_finding_without_line_number(self):
        """Test formatting a finding that has no line number."""
        findings = [
            AgentFinding(
                severity="info",
                file_path="config.py",
                line_number=None,
                title="Config Issue",
                description="A configuration issue",
            ),
        ]

        result = CommentFormatter.format([], [], findings)

        assert "config.py" in result
        assert "(config.py)" in result
        # Should not have line number in this case
        assert "**Line:**" not in result
