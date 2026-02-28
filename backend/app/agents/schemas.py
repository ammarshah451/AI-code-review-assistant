"""Agent schemas for CodeGuard AI multi-agent system."""

from typing import Dict, List, Literal, Optional

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
    pr_file_contents: Optional[Dict[str, str]]
    logic_findings: List[AgentFinding]
    security_findings: List[AgentFinding]
    quality_findings: List[AgentFinding]
    final_comment: str
