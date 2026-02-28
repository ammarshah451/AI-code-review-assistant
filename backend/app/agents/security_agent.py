"""Security Agent for identifying security vulnerabilities in code."""

from typing import Optional

from app.agents.base import BaseAgent
from app.agents.prompts import SECURITY_AGENT_PROMPT
from app.models import AgentType
from app.services.llm import LLMService


class SecurityAgent(BaseAgent):
    """Agent specialized in identifying security vulnerabilities.

    This agent analyzes code for issues such as:
    - SQL Injection
    - Command Injection
    - Cross-Site Scripting (XSS)
    - Hardcoded Secrets
    - Path Traversal
    - Insecure Deserialization
    - Authentication Issues
    - Sensitive Data Exposure
    - Insecure Dependencies
    - SSRF Vulnerabilities
    """

    def __init__(
        self,
        llm_service: Optional[LLMService] = None,
        prompt_template: Optional[str] = None,
    ):
        """Initialize the Security Agent.

        Args:
            llm_service: Optional LLM service. If not provided, creates a new instance.
            prompt_template: Optional prompt template override for multi-language support.
        """
        super().__init__(
            agent_type=AgentType.SECURITY,
            prompt_template=prompt_template or SECURITY_AGENT_PROMPT,
            llm_service=llm_service,
        )
