"""Logic Agent for detecting logic errors and bugs in code."""

from typing import Optional

from app.agents.base import BaseAgent
from app.agents.prompts import LOGIC_AGENT_PROMPT
from app.models import AgentType
from app.services.llm import LLMService


class LogicAgent(BaseAgent):
    """Agent specialized in detecting logic errors and bugs.

    This agent analyzes code for issues such as:
    - Null/None checks
    - Off-by-one errors
    - Type mismatches
    - Unreachable code
    - Incorrect error handling
    - Logic flaws
    - Resource leaks
    - Race conditions
    """

    def __init__(
        self,
        llm_service: Optional[LLMService] = None,
        prompt_template: Optional[str] = None,
    ):
        """Initialize the Logic Agent.

        Args:
            llm_service: Optional LLM service. If not provided, creates a new instance.
            prompt_template: Optional prompt template override for multi-language support.
        """
        super().__init__(
            agent_type=AgentType.LOGIC,
            prompt_template=prompt_template or LOGIC_AGENT_PROMPT,
            llm_service=llm_service,
        )
