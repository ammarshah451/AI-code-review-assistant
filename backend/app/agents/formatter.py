"""Comment formatter for converting agent findings to GitHub markdown."""

from typing import Dict, List

from app.agents.schemas import AgentFinding


class CommentFormatter:
    """Formats agent findings into GitHub markdown comments."""

    SEVERITY_EMOJI = {
        "critical": "\U0001F534",  # Red circle
        "warning": "\U0001F7E1",  # Yellow circle
        "info": "\U0001F535",  # Blue circle
    }
    SEVERITY_ORDER = ["critical", "warning", "info"]
    SEVERITY_LABEL = {
        "critical": "Critical",
        "warning": "Warning",
        "info": "Info",
    }

    @classmethod
    def format(
        cls,
        logic_findings: List[AgentFinding],
        security_findings: List[AgentFinding],
        quality_findings: List[AgentFinding],
    ) -> str:
        """Format all findings into a GitHub markdown comment.

        Args:
            logic_findings: Findings from the logic agent
            security_findings: Findings from the security agent
            quality_findings: Findings from the quality agent

        Returns:
            Formatted GitHub markdown comment string
        """
        # Combine all findings with agent type labels
        all_findings: List[tuple[AgentFinding, str]] = []
        for finding in logic_findings:
            all_findings.append((finding, "Logic"))
        for finding in security_findings:
            all_findings.append((finding, "Security"))
        for finding in quality_findings:
            all_findings.append((finding, "Quality"))

        # If no findings, return success message
        if not all_findings:
            return cls._format_no_issues()

        # Count findings by severity across all
        combined_findings = [f for f, _ in all_findings]
        counts = cls.count_by_severity(combined_findings)

        # Build the comment
        lines = ["## CodeGuard AI Review", "", "### Summary"]

        # Add summary counts
        for severity in cls.SEVERITY_ORDER:
            count = counts.get(severity, 0)
            if count > 0:
                emoji = cls.SEVERITY_EMOJI[severity]
                label = cls.SEVERITY_LABEL[severity]
                plural = "issues" if count != 1 else "issue"
                lines.append(f"- {emoji} **{count} {label}** {plural}")

        # Group findings by severity
        findings_by_severity: Dict[str, List[tuple[AgentFinding, str]]] = {
            s: [] for s in cls.SEVERITY_ORDER
        }
        for finding, agent_type in all_findings:
            findings_by_severity[finding.severity].append((finding, agent_type))

        # Add sections for each severity level
        for severity in cls.SEVERITY_ORDER:
            findings = findings_by_severity[severity]
            if findings:
                lines.append("")
                emoji = cls.SEVERITY_EMOJI[severity]
                label = cls.SEVERITY_LABEL[severity]
                lines.append(f"### {emoji} {label} Issues")
                lines.append("")

                for finding, agent_type in findings:
                    lines.append(cls._format_finding(finding, agent_type))
                    lines.append("")

        # Add footer
        lines.append("---")
        lines.append("*Automated review by CodeGuard AI*")

        return "\n".join(lines)

    @classmethod
    def count_by_severity(cls, findings: List[AgentFinding]) -> Dict[str, int]:
        """Count findings by severity level.

        Args:
            findings: List of agent findings

        Returns:
            Dictionary mapping severity to count
        """
        counts: Dict[str, int] = {}
        for finding in findings:
            severity = finding.severity
            counts[severity] = counts.get(severity, 0) + 1
        return counts

    @classmethod
    def _format_finding(cls, finding: AgentFinding, agent_type: str) -> str:
        """Format a single finding as a collapsible section.

        Args:
            finding: The agent finding to format
            agent_type: The type of agent (Logic, Security, Quality)

        Returns:
            Formatted markdown string for the finding
        """
        # Build location string
        location = finding.file_path
        if finding.line_number is not None:
            location = f"{finding.file_path}:{finding.line_number}"

        lines = [
            f"<details>",
            f"<summary><b>{finding.title}</b> ({location}) - {agent_type}</summary>",
            "",
            f"**File:** `{finding.file_path}`",
        ]

        if finding.line_number is not None:
            lines.append(f"**Line:** {finding.line_number}")

        lines.append(f"**Agent:** {agent_type}")
        lines.append("")
        lines.append(finding.description)

        if finding.suggestion:
            lines.append("")
            lines.append(f"**Suggestion:** {finding.suggestion}")

        lines.append("")
        lines.append("</details>")

        return "\n".join(lines)

    @classmethod
    def _format_no_issues(cls) -> str:
        """Format the message when no issues are found.

        Returns:
            Success message string
        """
        return (
            "## CodeGuard AI Review\n\n"
            "No issues found! Your code looks good.\n\n"
            "---\n"
            "*Automated review by CodeGuard AI*"
        )
