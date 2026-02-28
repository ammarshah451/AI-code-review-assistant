"""Quality Agent for reviewing code quality and maintainability."""

from typing import Optional

from app.agents.base import BaseAgent
from app.agents.prompts import QUALITY_AGENT_PROMPT
from app.models import AgentType
from app.services.llm import LLMService


class QualityAgent(BaseAgent):
    """Agent specialized in reviewing code quality and maintainability.

    This agent analyzes code for issues such as:
    - Style compliance
    - Documentation
    - Code Complexity
    - Naming Conventions
    - Type Hints / Type Safety
    - Code Duplication
    - Magic Numbers/Strings
    - Dead Code
    """

    def __init__(
        self,
        llm_service: Optional[LLMService] = None,
        prompt_template: Optional[str] = None,
    ):
        """Initialize the Quality Agent.

        Args:
            llm_service: Optional LLM service. If not provided, creates a new instance.
            prompt_template: Optional prompt template override for multi-language support.
        """
        super().__init__(
            agent_type=AgentType.QUALITY,
            prompt_template=prompt_template or QUALITY_AGENT_PROMPT,
            llm_service=llm_service,
        )
