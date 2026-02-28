"""Base agent class for CodeGuard AI code review agents."""

from typing import Dict, List, Optional

from app.agents.prompts import format_prompt
from app.agents.schemas import AgentFinding, AgentResponse
from app.models import AgentType
from app.services.llm import LLMService


class BaseAgent:
    """Base class for specialized code review agents.

    This class provides common functionality for all code review agents,
    including prompt formatting and LLM invocation.

    Attributes:
        agent_type: The type of agent (logic, security, quality).
        prompt_template: The prompt template string with {diff} and {files} placeholders.
        llm_service: The LLM service used for analysis.
    """

    def __init__(
        self,
        agent_type: AgentType,
        prompt_template: str,
        llm_service: Optional[LLMService] = None,
    ):
        """Initialize the base agent.

        Args:
            agent_type: The type of agent (logic, security, quality).
            prompt_template: The prompt template string with {diff} and {files} placeholders.
            llm_service: Optional LLM service. If not provided, creates a new instance.
        """
        self.agent_type = agent_type
        self.prompt_template = prompt_template
        self.llm_service = llm_service if llm_service is not None else LLMService()

    def analyze(
        self,
        diff: str,
        files: List[str],
        file_contents: Optional[Dict[str, str]] = None,
    ) -> List[AgentFinding]:
        """Analyze code diff and return findings.

        Args:
            diff: The code diff to analyze.
            files: List of file paths changed in the PR.
            file_contents: Optional mapping of file paths to their full content
                for context-aware analysis.

        Returns:
            List of AgentFinding objects representing issues found.
        """
        prompt = format_prompt(self.prompt_template, diff, files, file_contents)
        response = self.llm_service.invoke_structured(prompt, AgentResponse)
        return response.findings
