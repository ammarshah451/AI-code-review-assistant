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
