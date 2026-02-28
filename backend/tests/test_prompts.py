"""Tests for prompt templates."""

import pytest

from app.agents.prompts import (
    LOGIC_AGENT_PROMPT,
    QUALITY_AGENT_PROMPT,
    SECURITY_AGENT_PROMPT,
    format_prompt,
)


class TestPromptTemplates:
    """Tests for prompt template contents."""

    def test_logic_prompt_exists(self):
        """Test that logic prompt contains expected keywords and placeholders."""
        assert "{diff}" in LOGIC_AGENT_PROMPT
        assert "{files}" in LOGIC_AGENT_PROMPT
        # Check for logic-specific keywords
        assert "null" in LOGIC_AGENT_PROMPT.lower() or "none" in LOGIC_AGENT_PROMPT.lower()
        assert "off-by-one" in LOGIC_AGENT_PROMPT.lower()
        assert "type" in LOGIC_AGENT_PROMPT.lower()
        assert "unreachable" in LOGIC_AGENT_PROMPT.lower()
        assert "error handling" in LOGIC_AGENT_PROMPT.lower()
        # Check severity levels are mentioned
        assert "critical" in LOGIC_AGENT_PROMPT.lower()
        assert "warning" in LOGIC_AGENT_PROMPT.lower()
        assert "info" in LOGIC_AGENT_PROMPT.lower()

    def test_security_prompt_exists(self):
        """Test that security prompt contains expected keywords and placeholders."""
        assert "{diff}" in SECURITY_AGENT_PROMPT
        assert "{files}" in SECURITY_AGENT_PROMPT
        # Check for security-specific keywords
        assert "sql injection" in SECURITY_AGENT_PROMPT.lower()
        assert "command injection" in SECURITY_AGENT_PROMPT.lower()
        assert "xss" in SECURITY_AGENT_PROMPT.lower()
        assert "secrets" in SECURITY_AGENT_PROMPT.lower() or "hardcoded" in SECURITY_AGENT_PROMPT.lower()
        assert "path traversal" in SECURITY_AGENT_PROMPT.lower()
        assert "deserialization" in SECURITY_AGENT_PROMPT.lower()
        # Check severity levels are mentioned
        assert "critical" in SECURITY_AGENT_PROMPT.lower()
        assert "warning" in SECURITY_AGENT_PROMPT.lower()
        assert "info" in SECURITY_AGENT_PROMPT.lower()

    def test_quality_prompt_exists(self):
        """Test that quality prompt contains expected keywords and placeholders."""
        assert "{diff}" in QUALITY_AGENT_PROMPT
        assert "{files}" in QUALITY_AGENT_PROMPT
        # Check for quality-specific keywords
        assert "pep 8" in QUALITY_AGENT_PROMPT.lower() or "pep8" in QUALITY_AGENT_PROMPT.lower()
        assert "docstring" in QUALITY_AGENT_PROMPT.lower()
        assert "complexity" in QUALITY_AGENT_PROMPT.lower()
        assert "naming" in QUALITY_AGENT_PROMPT.lower()
        assert "type hint" in QUALITY_AGENT_PROMPT.lower()
        # Check severity levels are mentioned
        assert "critical" in QUALITY_AGENT_PROMPT.lower()
        assert "warning" in QUALITY_AGENT_PROMPT.lower()
        assert "info" in QUALITY_AGENT_PROMPT.lower()


class TestFormatPrompt:
    """Tests for format_prompt function."""

    def test_format_prompt_with_diff(self):
        """Test formatting a prompt with diff and files."""
        template = "Review these files: {files}\n\nDiff:\n{diff}"
        diff = "- old line\n+ new line"
        files = ["main.py", "utils.py"]

        result = format_prompt(template, diff, files)

        assert "main.py, utils.py" in result
        assert "- old line\n+ new line" in result
        assert "{diff}" not in result
        assert "{files}" not in result

    def test_format_prompt_with_empty_diff(self):
        """Test formatting a prompt with empty diff."""
        template = "Files: {files}\nDiff: {diff}"
        diff = ""
        files = ["test.py"]

        result = format_prompt(template, diff, files)

        assert "test.py" in result
        assert "Diff: " in result
        assert "{diff}" not in result
        assert "{files}" not in result

    def test_format_prompt_preserves_template(self):
        """Test that format_prompt preserves non-placeholder content."""
        template = "# Header\n\nFiles: {files}\n\n## Analysis\n\n{diff}\n\n# Footer"
        diff = "sample diff"
        files = ["file.py"]

        result = format_prompt(template, diff, files)

        assert "# Header" in result
        assert "## Analysis" in result
        assert "# Footer" in result
        assert "sample diff" in result
        assert "file.py" in result

    def test_format_prompt_with_empty_files(self):
        """Test formatting a prompt with no files."""
        template = "Files: {files}\nDiff: {diff}"
        diff = "some diff"
        files = []

        result = format_prompt(template, diff, files)

        assert "No files specified" in result
        assert "some diff" in result

    def test_format_prompt_with_single_file(self):
        """Test formatting a prompt with a single file."""
        template = "Files: {files}\nDiff: {diff}"
        diff = "diff content"
        files = ["single.py"]

        result = format_prompt(template, diff, files)

        assert "single.py" in result
        assert "," not in result.split("Diff:")[0]  # No comma for single file

    def test_format_prompt_with_real_templates(self):
        """Test format_prompt works with actual agent templates."""
        diff = "+def hello():\n+    print('Hello')"
        files = ["hello.py", "world.py"]

        logic_result = format_prompt(LOGIC_AGENT_PROMPT, diff, files)
        security_result = format_prompt(SECURITY_AGENT_PROMPT, diff, files)
        quality_result = format_prompt(QUALITY_AGENT_PROMPT, diff, files)

        # All should have the diff inserted
        assert "+def hello():" in logic_result
        assert "+def hello():" in security_result
        assert "+def hello():" in quality_result

        # All should have files inserted
        assert "hello.py, world.py" in logic_result
        assert "hello.py, world.py" in security_result
        assert "hello.py, world.py" in quality_result

        # No placeholders should remain
        assert "{diff}" not in logic_result
        assert "{files}" not in logic_result
