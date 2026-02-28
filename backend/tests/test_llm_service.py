"""Tests for LLM service."""

import pytest
from unittest.mock import MagicMock, patch

from pydantic import BaseModel

from app.services.llm import LLMService, get_llm_service


class TestLLMService:
    """Tests for LLMService."""

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_init_with_api_key(self, mock_chat_class):
        """Test client initialization with API key."""
        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        assert service.api_key == "test-api-key"
        assert service.model == "gemini-2.5-flash"
        mock_chat_class.assert_called_once_with(
            model="gemini-2.5-flash",
            google_api_key="test-api-key",
            temperature=0.1,
        )

    @patch("app.services.llm.settings")
    def test_init_without_api_key_raises(self, mock_settings):
        """Test that missing API key raises ValueError."""
        mock_settings.google_api_key = ""

        with pytest.raises(ValueError, match="Google API key is required"):
            LLMService()

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_invoke_returns_content(self, mock_chat_class):
        """Test invoke method returns response content."""
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "This code has a potential bug on line 5."
        mock_llm.invoke.return_value = mock_response
        mock_chat_class.return_value = mock_llm

        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        result = service.invoke("Analyze this code for bugs")

        assert result == "This code has a potential bug on line 5."
        mock_llm.invoke.assert_called_once_with("Analyze this code for bugs")

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_invoke_structured_returns_pydantic_model(self, mock_chat_class):
        """Test invoke_structured method returns Pydantic model instance."""

        class CodeReviewResult(BaseModel):
            has_issues: bool
            issue_count: int
            summary: str

        mock_llm = MagicMock()
        mock_response = MagicMock()
        # Return valid JSON that matches the schema
        mock_response.content = '{"has_issues": true, "issue_count": 2, "summary": "Found issues"}'
        mock_llm.invoke.return_value = mock_response
        mock_chat_class.return_value = mock_llm

        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        result = service.invoke_structured(
            "Analyze this code", output_schema=CodeReviewResult
        )

        assert result.has_issues is True
        assert result.issue_count == 2
        assert result.summary == "Found issues"

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_invoke_structured_handles_markdown_code_blocks(self, mock_chat_class):
        """Test invoke_structured handles JSON wrapped in markdown code blocks."""

        class CodeReviewResult(BaseModel):
            has_issues: bool
            issue_count: int
            summary: str

        mock_llm = MagicMock()
        mock_response = MagicMock()
        # Return JSON wrapped in markdown code blocks
        mock_response.content = '```json\n{"has_issues": true, "issue_count": 3, "summary": "Multiple issues"}\n```'
        mock_llm.invoke.return_value = mock_response
        mock_chat_class.return_value = mock_llm

        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        result = service.invoke_structured(
            "Analyze this code", output_schema=CodeReviewResult
        )

        assert result.has_issues is True
        assert result.issue_count == 3
        assert result.summary == "Multiple issues"

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    @patch("app.services.llm.settings")
    def test_get_llm_service_returns_instance(self, mock_settings, mock_chat_class):
        """Test get_llm_service returns an LLMService instance."""
        mock_settings.google_api_key = "settings-api-key"
        mock_settings.llm_model = "gemini-2.5-flash"

        service = get_llm_service()

        assert isinstance(service, LLMService)
        mock_chat_class.assert_called_once_with(
            model="gemini-2.5-flash",
            google_api_key="settings-api-key",
            temperature=0.1,
        )

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_invoke_structured_handles_list_content(self, mock_chat_class):
        """Test invoke_structured handles response.content being a list (Gemini edge case)."""

        class CodeReviewResult(BaseModel):
            has_issues: bool
            issue_count: int
            summary: str

        mock_llm = MagicMock()
        mock_response = MagicMock()
        # Gemini sometimes returns content as a list of strings
        mock_response.content = ['{"has_issues": true, ', '"issue_count": 1, ', '"summary": "Issue found"}']
        mock_llm.invoke.return_value = mock_response
        mock_chat_class.return_value = mock_llm

        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        result = service.invoke_structured(
            "Analyze this code", output_schema=CodeReviewResult
        )

        assert result.has_issues is True
        assert result.issue_count == 1
        assert result.summary == "Issue found"

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_invoke_structured_handles_list_content_structured(self, mock_chat_class):
        """Test invoke_structured handles response.content being a structured list."""
        from typing import List

        class Finding(BaseModel):
            title: str
            severity: str

        class FindingsResult(BaseModel):
            findings: List[Finding]
            summary: str

        mock_llm = MagicMock()
        mock_response = MagicMock()
        # Gemini sometimes returns structured data directly as a list
        mock_response.content = [{"title": "Bug found", "severity": "high"}]
        mock_llm.invoke.return_value = mock_response
        mock_chat_class.return_value = mock_llm

        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        result = service.invoke_structured(
            "Analyze this code", output_schema=FindingsResult
        )

        # When findings list is returned directly, it gets wrapped
        assert len(result.findings) == 1
        assert result.findings[0].title == "Bug found"
        assert result.findings[0].severity == "high"

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_invoke_structured_handles_invalid_escape_sequences(self, mock_chat_class):
        """Test invoke_structured handles invalid JSON escape sequences from LLM."""

        class CodePattern(BaseModel):
            pattern: str
            description: str

        mock_llm = MagicMock()
        mock_response = MagicMock()
        # LLM returns JSON with invalid escape sequences (common in regex patterns)
        # \s, \d, \w are invalid JSON escapes but common in regex
        # Using a string that represents what the LLM actually returns
        mock_response.content = '{"pattern": "\\s+\\d+\\w*", "description": "Matches whitespace, digits, and word chars"}'
        mock_llm.invoke.return_value = mock_response
        mock_chat_class.return_value = mock_llm

        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")
        result = service.invoke_structured(
            "Extract pattern", output_schema=CodePattern
        )

        # The pattern should be parsed successfully (escaped properly)
        assert "s" in result.pattern  # Contains the regex pattern characters
        assert result.description == "Matches whitespace, digits, and word chars"

    @patch("app.services.llm.ChatGoogleGenerativeAI")
    def test_fix_json_escapes_method(self, mock_chat_class):
        """Test the _fix_json_escapes helper method directly."""
        import json as json_module
        service = LLMService(api_key="test-api-key", model="gemini-2.5-flash")

        # Test various invalid escape sequences
        # Note: In Python strings, \s is literally backslash-s (the same as what LLM returns)
        test_cases = [
            ('{"regex": "\\s+"}', True),  # \s should be escaped to \\s
            ('{"regex": "\\d+"}', True),  # \d should be escaped to \\d
            ('{"regex": "\\w+"}', True),  # \w should be escaped to \\w
            ('{"text": "normal text"}', True),  # Normal text, no change needed
            ('{"text": "valid\\nescapes"}', True),  # Valid \n escape, no change
        ]

        for content, should_parse in test_cases:
            fixed = service._fix_json_escapes(content)
            try:
                json_module.loads(fixed)
                parsed = True
            except json_module.JSONDecodeError:
                parsed = False
            assert parsed == should_parse, f"Failed for: {content}, got: {fixed}"
