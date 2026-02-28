"""LLM service for AI code review operations."""

import json
import re
from typing import Optional, Type, TypeVar

from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import settings

T = TypeVar("T")


class LLMService:
    """LLM service wrapping Google Gemini for code review agents."""

    TEMPERATURE = 0.1

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize LLM service with API key.

        Args:
            api_key: Google API key. If not provided, uses settings.google_api_key.

        Raises:
            ValueError: If no API key is available.
        """
        self.api_key = api_key or settings.google_api_key
        if not self.api_key:
            raise ValueError("Google API key is required")

        self.model = model or settings.llm_model
        self.llm = ChatGoogleGenerativeAI(
            model=self.model,
            google_api_key=self.api_key,
            temperature=self.TEMPERATURE,
        )

    def _fix_json_escapes(self, content: str) -> str:
        """Fix invalid JSON escape sequences from LLM responses.

        LLMs sometimes produce invalid escape sequences like \\s, \\d, \\w
        when describing regex patterns. This method escapes them properly.

        Args:
            content: JSON string that may contain invalid escapes.

        Returns:
            Fixed JSON string with valid escape sequences.
        """
        # In JSON, only these escape sequences are valid:
        # \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
        # Everything else like \s, \d, \w (common in regex) is invalid
        #
        # We need to find backslash followed by invalid characters and double the backslash
        # But we must not double already-escaped backslashes (\\s should stay \\s)

        # Pattern to find a single backslash followed by an invalid escape character
        # Valid JSON escapes: " \ / b f n r t u
        # We match backslash NOT followed by these, and NOT preceded by backslash
        def fix_escape(match):
            # The match is a backslash followed by a character
            # We need to return double backslash + the character
            char = match.group(1)
            return '\\\\' + char

        # Match single backslash (not preceded by another backslash) followed by
        # characters that are not valid JSON escapes
        # Using negative lookbehind for backslash and negative lookahead for valid escapes
        # Valid escape chars in JSON: " \ / b f n r t u
        pattern = r'(?<!\\)\\([^"\\/bfnrtu])'
        content = re.sub(pattern, fix_escape, content)

        # Also handle \' which is invalid in JSON (should be just ')
        content = content.replace("\\'", "'")

        return content

    def invoke(self, prompt: str) -> str:
        """Send prompt to model and return response content.

        Args:
            prompt: The prompt to send to the model.

        Returns:
            The model's response content as a string.
        """
        response = self.llm.invoke(prompt)
        return response.content

    def invoke_structured(self, prompt: str, output_schema: Type[T], max_retries: int = 2) -> T:
        """Send prompt and return structured Pydantic model response.

        Uses JSON mode with manual parsing to support Gemini 2.5 models
        which have compatibility issues with LangChain's structured output.

        Args:
            prompt: The prompt to send to the model.
            output_schema: Pydantic model class to parse response into.
            max_retries: Maximum number of retries on failure.

        Returns:
            An instance of the output_schema Pydantic model.
        """
        # Generate JSON schema from the Pydantic model
        schema = output_schema.model_json_schema()

        # Append JSON format instructions to the prompt
        json_prompt = f"""{prompt}

IMPORTANT: You MUST respond with valid JSON that matches this schema:
{json.dumps(schema, indent=2)}

Respond ONLY with the JSON object, no markdown code blocks, no explanations."""

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                # Get response
                response = self.llm.invoke(json_prompt)
                content = response.content

                # Handle case where content is a list (some Gemini responses)
                if isinstance(content, list):
                    # Join list elements if they're strings, or convert to JSON
                    if all(isinstance(item, str) for item in content):
                        content = "".join(content)
                    else:
                        # Content is structured data, convert to JSON string
                        content = json.dumps(content)

                # Handle empty or None response
                if not content or (isinstance(content, str) and not content.strip()):
                    raise ValueError("LLM returned empty response")

                # Extract JSON from response (handle possible markdown code blocks)
                json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
                if json_match:
                    content = json_match.group(1).strip()

                # Fix common JSON escape issues from LLM responses
                # LLMs sometimes produce invalid escape sequences like \s, \d, \w in regex patterns
                content = self._fix_json_escapes(content)

                # Strip any leading/trailing whitespace
                content = content.strip()

                # Handle empty content after processing
                if not content:
                    raise ValueError("LLM returned empty JSON content")

                # Parse and validate with Pydantic
                data = json.loads(content)

                # Handle case where LLM returns a list instead of the expected object
                # This happens when it returns findings directly instead of AgentResponse
                if isinstance(data, list) and hasattr(output_schema, 'model_fields'):
                    # Check if the schema expects a 'findings' field
                    if 'findings' in output_schema.model_fields:
                        data = {"findings": data, "summary": "Analysis complete."}

                return output_schema.model_validate(data)

            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                if attempt < max_retries:
                    import time
                    time.sleep(1)  # Brief delay before retry
                    continue
                raise

        # This shouldn't be reached, but just in case
        raise last_error if last_error else ValueError("Failed to get structured response")


def get_llm_service() -> LLMService:
    """Dependency injection helper for LLMService.

    Returns:
        An LLMService instance using settings from environment.
    """
    return LLMService()
