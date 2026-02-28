"""Background processor for PR review jobs."""

import logging
import re
import time
from typing import Dict, List, Any, Optional
from uuid import UUID

from app.agents.schemas import AgentFinding
from app.agents.supervisor import ReviewSupervisor
from app.db.database import get_db
from app.db.repositories import FindingRepo, ReviewRepo, SettingsRepo
from app.models.finding import AgentType, Severity
from app.models.review import ReviewStatus
from app.models import FindingCreate
from app.services.github import GitHubService
from app.services.queue import RateLimiter, get_redis_client
from app.services.websocket import manager as ws_manager

# Configure logging
logger = logging.getLogger(__name__)

# Progress stages with percentages
PROGRESS_STAGES = {
    "fetching_diff": (10, "Fetching PR diff from GitHub"),
    "fetching_context": (15, "Fetching file context"),
    "logic_agent": (25, "Running Logic Agent"),
    "security_agent": (40, "Running Security Agent"),
    "quality_agent": (55, "Running Quality Agent"),
    "critique_agent": (70, "Running Critique Agent"),
    "deduplicating": (80, "Deduplicating findings"),
    "formatting": (90, "Formatting comment"),
    "posting": (95, "Posting to GitHub"),
    "complete": (100, "Review complete"),
}


async def _broadcast_progress_async(review_id: str, stage: str) -> None:
    """Async helper to broadcast progress update.

    Args:
        review_id: The review ID to broadcast to
        stage: The current stage name
    """
    if stage not in PROGRESS_STAGES:
        return

    progress, message = PROGRESS_STAGES[stage]
    data = {
        "stage": stage,
        "progress": progress,
        "message": message,
    }
    await ws_manager.broadcast(review_id, data)


def broadcast_progress(review_id: str, stage: str) -> None:
    """Broadcast progress update to connected WebSocket clients.

    Args:
        review_id: The review ID to broadcast to
        stage: The current stage name
    """
    import asyncio

    if stage not in PROGRESS_STAGES:
        return

    progress, message = PROGRESS_STAGES[stage]
    data = {
        "stage": stage,
        "progress": progress,
        "message": message,
    }

    # Run async broadcast in sync context
    try:
        loop = asyncio.get_running_loop()
        # If we're in an async context, schedule the broadcast
        asyncio.ensure_future(ws_manager.broadcast(review_id, data))
    except RuntimeError:
        # No running loop, try to get event loop or create one
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(ws_manager.broadcast(review_id, data))
            else:
                loop.run_until_complete(ws_manager.broadcast(review_id, data))
        except RuntimeError:
            # No event loop available, create new one
            asyncio.run(ws_manager.broadcast(review_id, data))


def map_agent_severity(agent_severity: str) -> Severity:
    """Map agent severity to database severity.

    Agent findings use: critical, warning, info
    Database supports: critical, high, medium, low, info

    Args:
        agent_severity: Severity from agent finding

    Returns:
        Mapped Severity enum value
    """
    mapping = {
        "critical": Severity.CRITICAL,
        "warning": Severity.MEDIUM,
        "info": Severity.INFO,
    }
    return mapping.get(agent_severity, Severity.INFO)


def extract_files_from_diff(diff: str) -> List[str]:
    """Extract file paths from a unified diff.

    Args:
        diff: Unified diff text

    Returns:
        List of file paths changed in the diff
    """
    files = []
    # Match lines like: diff --git a/path/to/file.py b/path/to/file.py
    pattern = r"^diff --git a/(.+?) b/"
    for match in re.finditer(pattern, diff, re.MULTILINE):
        files.append(match.group(1))
    return files


def map_agent_type(agent_type_str: str) -> AgentType:
    """Map agent type string to AgentType enum.

    Args:
        agent_type_str: Agent type as string (logic, security, quality)

    Returns:
        AgentType enum value
    """
    mapping = {
        "logic": AgentType.LOGIC,
        "security": AgentType.SECURITY,
        "quality": AgentType.QUALITY,
    }
    return mapping.get(agent_type_str, AgentType.LOGIC)


# Map severity levels for threshold filtering
SEVERITY_RANK = {
    Severity.CRITICAL: 0,
    Severity.HIGH: 1,
    Severity.MEDIUM: 2,
    Severity.LOW: 3,
    Severity.INFO: 4,
}


def process_review(job_data: Dict[str, Any]) -> None:
    """Process a PR review job in the background.

    This function runs as a FastAPI BackgroundTask and handles:
    1. Checking repository settings (enabled, agents, severity threshold)
    2. Fetching the PR diff from GitHub
    3. Running the enabled review agents (Logic, Security, Quality)
    4. Filtering findings by severity threshold
    5. Saving findings to the database
    6. Posting a comment to the GitHub PR
    7. Updating the review status

    Args:
        job_data: Dictionary containing:
            - review_id: UUID of the review record
            - owner: GitHub repository owner
            - repo: GitHub repository name
            - pr_number: Pull request number
            - commit_sha: Commit SHA being reviewed
    """
    review_id = job_data["review_id"]
    owner = job_data["owner"]
    repo = job_data["repo"]
    pr_number = job_data["pr_number"]

    logger.info(f"Processing review {review_id} for {owner}/{repo}#{pr_number}")

    # Initialize services
    db = get_db()
    review_repo = ReviewRepo(db)
    finding_repo = FindingRepo(db)
    settings_repo = SettingsRepo(db)
    github_service = GitHubService()
    supervisor = ReviewSupervisor()

    try:
        # 1. Update status to processing
        review_repo.update_status(UUID(review_id), ReviewStatus.PROCESSING)
        logger.info(f"Review {review_id}: status -> processing")

        # 1b. Fetch repository settings
        review = review_repo.get_by_id(UUID(review_id))
        repo_settings = None
        if review:
            repo_settings = settings_repo.get_by_repository(review.repository_id)

        # 1c. Check if reviews are enabled for this repository
        if repo_settings and not repo_settings.enabled:
            logger.info(f"Review {review_id}: reviews disabled for this repository, skipping")
            review_repo.update_status(UUID(review_id), ReviewStatus.COMPLETED)
            broadcast_progress(review_id, "complete")
            return

        # 2. Fetch PR diff from GitHub
        broadcast_progress(review_id, "fetching_diff")
        logger.info(f"Review {review_id}: fetching diff")
        diff = github_service.get_pr_diff(owner, repo, pr_number)

        # 2b. Store raw diff on the review record for the inline diff viewer
        review_repo.update_diff(UUID(review_id), diff)

        # 3. Extract file paths from diff
        files = extract_files_from_diff(diff)
        logger.info(f"Review {review_id}: found {len(files)} files")

        # 3a. Apply .codeguardignore filtering
        from app.utils.codeguardignore import parse_ignore_file, filter_diff
        commit_sha = job_data.get("commit_sha", "main")

        ignore_content = github_service.get_file_content(
            owner, repo, ".codeguardignore", ref=commit_sha
        )
        user_patterns = parse_ignore_file(ignore_content) if ignore_content else []

        diff, files, ignored_files = filter_diff(diff, user_patterns)
        if ignored_files:
            logger.info(
                f"Review {review_id}: ignored {len(ignored_files)} files via .codeguardignore: "
                f"{', '.join(ignored_files[:5])}"
            )

        # 3b. Fetch full file contents for context-aware reviews
        broadcast_progress(review_id, "fetching_context")
        file_contents = _fetch_file_contents(
            github_service, owner, repo, files, ref=commit_sha
        )
        if file_contents:
            logger.info(
                f"Review {review_id}: fetched context for {len(file_contents)} files"
            )

        # 4. Check rate limit with retry
        redis = get_redis_client()
        rate_limiter = RateLimiter(redis)
        max_retries = 3
        retry_delay = 5  # seconds

        for attempt in range(max_retries):
            if rate_limiter.can_proceed("gemini"):
                break
            if attempt < max_retries - 1:
                logger.warning(
                    f"Review {review_id}: rate limited, retrying in {retry_delay}s "
                    f"(attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(retry_delay)
        else:
            raise Exception("Rate limit exceeded after max retries")

        # 5. Detect language and build supervisor with language-specific prompts
        from app.agents.prompts import detect_language, get_prompts_for_language
        agents_config = repo_settings.agents_enabled if repo_settings else None
        from app.agents.logic_agent import LogicAgent
        from app.agents.security_agent import SecurityAgent
        from app.agents.quality_agent import QualityAgent

        detected_lang = detect_language(files)
        logic_prompt, security_prompt, quality_prompt = get_prompts_for_language(detected_lang)
        logger.info(f"Review {review_id}: detected language '{detected_lang}'")

        # Pass None for disabled agents — supervisor will skip them
        logic = LogicAgent(prompt_template=logic_prompt) if (not agents_config or agents_config.logic) else None
        security = SecurityAgent(prompt_template=security_prompt) if (not agents_config or agents_config.security) else None
        quality = QualityAgent(prompt_template=quality_prompt) if (not agents_config or agents_config.quality) else None

        supervisor = ReviewSupervisor(
            logic_agent=logic,
            security_agent=security,
            quality_agent=quality,
        )

        broadcast_progress(review_id, "logic_agent")
        logger.info(f"Review {review_id}: running agents")
        result = supervisor.run(diff, files, file_contents)
        broadcast_progress(review_id, "critique_agent")

        # Increment rate limit counter after successful run
        rate_limiter.increment("gemini")

        # 6. Collect and map findings
        broadcast_progress(review_id, "formatting")
        all_findings: List[FindingCreate] = []

        # Determine severity threshold for filtering
        severity_threshold = repo_settings.severity_threshold if repo_settings else Severity.INFO
        threshold_rank = SEVERITY_RANK.get(severity_threshold, 4)

        # Process logic findings
        for finding in result["logic_findings"]:
            mapped = _map_finding(finding, review_id, "logic")
            if SEVERITY_RANK.get(mapped.severity, 4) <= threshold_rank:
                all_findings.append(mapped)

        # Process security findings
        for finding in result["security_findings"]:
            mapped = _map_finding(finding, review_id, "security")
            if SEVERITY_RANK.get(mapped.severity, 4) <= threshold_rank:
                all_findings.append(mapped)

        # Process quality findings
        for finding in result["quality_findings"]:
            mapped = _map_finding(finding, review_id, "quality")
            if SEVERITY_RANK.get(mapped.severity, 4) <= threshold_rank:
                all_findings.append(mapped)

        logger.info(f"Review {review_id}: found {len(all_findings)} findings (threshold: {severity_threshold.value})")

        # 7. Save findings to database
        if all_findings:
            finding_repo.create_many(all_findings)
            logger.info(f"Review {review_id}: saved findings to database")

        # 8. Post comment to GitHub
        broadcast_progress(review_id, "posting")
        comment = result["final_comment"]
        if comment:
            comment_response = github_service.post_comment(
                owner, repo, pr_number, comment
            )
            comment_id = comment_response.get("id")
            logger.info(f"Review {review_id}: posted comment {comment_id}")
        else:
            comment_id = None

        # 9. Update review status to completed
        review_repo.update_status(
            UUID(review_id), ReviewStatus.COMPLETED, comment_id=comment_id
        )
        broadcast_progress(review_id, "complete")
        logger.info(f"Review {review_id}: status -> completed")

    except Exception as e:
        # Log the error
        logger.error(f"Review {review_id}: failed with error: {e}", exc_info=True)

        # Update status to failed
        try:
            review_repo.update_status(UUID(review_id), ReviewStatus.FAILED)
            logger.info(f"Review {review_id}: status -> failed")
        except Exception as status_error:
            logger.error(
                f"Review {review_id}: failed to update status: {status_error}"
            )


def _map_finding(
    finding: AgentFinding, review_id: str, agent_type: str
) -> FindingCreate:
    """Map an agent finding to a database FindingCreate model.

    Args:
        finding: Agent finding from the supervisor
        review_id: UUID of the review
        agent_type: Type of agent (logic, security, quality)

    Returns:
        FindingCreate model ready for database insertion
    """
    return FindingCreate(
        review_id=UUID(review_id),
        agent_type=map_agent_type(agent_type),
        severity=map_agent_severity(finding.severity),
        file_path=finding.file_path,
        line_number=finding.line_number,
        title=finding.title,
        description=finding.description,
        suggestion=finding.suggestion,
        confidence=getattr(finding, 'confidence', 'medium'),
    )


# Context-aware review limits
MAX_CONTEXT_FILES = 5
MAX_LINES_PER_FILE = 500
MAX_TOTAL_CONTEXT_BYTES = 50_000  # 50KB


def _fetch_file_contents(
    github_service: GitHubService,
    owner: str,
    repo: str,
    files: List[str],
    ref: str = "main",
) -> Optional[Dict[str, str]]:
    """Fetch full file contents for context-aware reviews.

    Fetches up to MAX_CONTEXT_FILES files, each capped at MAX_LINES_PER_FILE lines.
    Total context is capped at MAX_TOTAL_CONTEXT_BYTES to respect LLM token limits.

    Args:
        github_service: GitHub API client
        owner: Repository owner
        repo: Repository name
        files: List of file paths to fetch
        ref: Git ref (branch, tag, or commit SHA)

    Returns:
        Dict mapping file paths to content, or None if no files fetched
    """
    file_contents: Dict[str, str] = {}
    total_bytes = 0

    for file_path in files[:MAX_CONTEXT_FILES]:
        try:
            content = github_service.get_file_content(owner, repo, file_path, ref)
            if content is None:
                continue

            # Cap individual file at MAX_LINES_PER_FILE lines
            lines = content.splitlines()
            if len(lines) > MAX_LINES_PER_FILE:
                content = "\n".join(lines[:MAX_LINES_PER_FILE])
                content += f"\n\n... (truncated, {len(lines) - MAX_LINES_PER_FILE} more lines)"

            # Check total size cap
            content_bytes = len(content.encode("utf-8"))
            if total_bytes + content_bytes > MAX_TOTAL_CONTEXT_BYTES:
                logger.info(
                    f"Context size limit reached ({total_bytes} bytes), "
                    f"skipping remaining files"
                )
                break

            file_contents[file_path] = content
            total_bytes += content_bytes

        except Exception as e:
            logger.warning(f"Failed to fetch content for {file_path}: {e}")
            continue

    return file_contents if file_contents else None

