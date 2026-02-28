"""Utility for parsing .codeguardignore files and filtering PR files.

Supports glob patterns (via fnmatch) for excluding files from code review.
"""

import fnmatch
import re
from typing import List, Tuple


# Default patterns always excluded from review (even without .codeguardignore)
DEFAULT_IGNORE_PATTERNS = [
    "*.lock",
    "*.min.js",
    "*.min.css",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "*.generated.*",
    "*.pb.go",
    "*.pb.py",
]


def parse_ignore_file(content: str) -> List[str]:
    """Parse a .codeguardignore file into a list of glob patterns.

    Strips comments (lines starting with #), blank lines, and whitespace.

    Args:
        content: Raw content of the .codeguardignore file.

    Returns:
        List of glob pattern strings.
    """
    patterns = []
    for line in content.splitlines():
        line = line.strip()
        # Skip empty lines and comments
        if not line or line.startswith("#"):
            continue
        patterns.append(line)
    return patterns


def should_ignore_file(file_path: str, patterns: List[str]) -> bool:
    """Check if a file path matches any ignore pattern.

    Matches against both the full path and the basename, so patterns like
    '*.test.py' match 'src/utils/helper.test.py'.

    Args:
        file_path: The file path to check (relative to repo root).
        patterns: List of glob patterns.

    Returns:
        True if the file should be ignored (matches a pattern).
    """
    for pattern in patterns:
        # Match against full path
        if fnmatch.fnmatch(file_path, pattern):
            return True
        # Match against basename only (e.g., '*.lock' matches 'vendor/Gemfile.lock')
        if fnmatch.fnmatch(file_path.split("/")[-1], pattern):
            return True
        # Match directory patterns (e.g., 'vendor/*' matches 'vendor/pkg/foo.go')
        if "/" in pattern and fnmatch.fnmatch(file_path, pattern):
            return True
    return False


def filter_diff(
    diff: str, patterns: List[str]
) -> Tuple[str, List[str], List[str]]:
    """Filter a unified diff to remove sections for ignored files.

    Splits the diff by file boundaries (lines starting with 'diff --git'),
    checks each file against the patterns, and recombines only the allowed files.

    Args:
        diff: Full unified diff text.
        patterns: List of glob patterns (including defaults).

    Returns:
        Tuple of (filtered_diff, kept_files, ignored_files).
    """
    # Combine with default patterns
    all_patterns = DEFAULT_IGNORE_PATTERNS + patterns

    # Split diff by file sections
    file_sections = re.split(r"(?=^diff --git )", diff, flags=re.MULTILINE)

    kept_sections = []
    kept_files = []
    ignored_files = []

    for section in file_sections:
        if not section.strip():
            continue

        # Extract file path from diff header
        match = re.match(r"^diff --git a/(.+?) b/", section)
        if not match:
            # Not a diff section (could be preamble), keep it
            kept_sections.append(section)
            continue

        file_path = match.group(1)

        if should_ignore_file(file_path, all_patterns):
            ignored_files.append(file_path)
        else:
            kept_sections.append(section)
            kept_files.append(file_path)

    filtered_diff = "".join(kept_sections)
    return filtered_diff, kept_files, ignored_files
