#!/usr/bin/env python
"""
CodeGuard AI - System Health Check

Run this script to verify all system components are working before starting the application.

Usage:
    cd backend
    python healthcheck.py              # Full health check
    python healthcheck.py --skip-agents  # Skip agent test (faster, no LLM calls)
    python healthcheck.py --quick        # Quick check (skip agents and LLM)

The script will check:
    1. Environment variables
    2. Database connectivity (Supabase)
    3. Redis connectivity (Upstash)
    4. LLM service (Gemini)
    5. GitHub API
    6. Agent pipeline
    7. Worker module
"""

import argparse
import sys
import time
from datetime import datetime
from typing import Tuple, List, Optional

# ANSI color codes
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


def print_header():
    """Print the health check header."""
    print(f"\n{Colors.CYAN}{Colors.BOLD}")
    print("=" * 60)
    print("        CodeGuard AI - System Health Check")
    print("=" * 60)
    print(f"{Colors.END}")
    print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()


def print_check(name: str, status: bool, message: str = "", duration: float = 0):
    """Print a check result."""
    icon = f"{Colors.GREEN}[PASS]{Colors.END}" if status else f"{Colors.RED}[FAIL]{Colors.END}"
    duration_str = f" ({duration:.2f}s)" if duration > 0 else ""
    print(f"  {icon} {name}{duration_str}")
    if message:
        prefix = "       "
        for line in message.split("\n"):
            print(f"{prefix}{Colors.YELLOW}{line}{Colors.END}")


def print_section(name: str):
    """Print a section header."""
    print(f"\n{Colors.BOLD}>> {name}{Colors.END}")
    print("-" * 40)


def check_environment() -> Tuple[bool, List[str]]:
    """Check required environment variables."""
    from app.config import settings

    issues = []

    # Required
    if not settings.supabase_url:
        issues.append("SUPABASE_URL is not set")
    if not settings.supabase_key:
        issues.append("SUPABASE_KEY is not set")
    if not settings.google_api_key:
        issues.append("GOOGLE_API_KEY is not set")
    if not settings.github_token:
        issues.append("GITHUB_TOKEN is not set")

    # Optional but recommended
    warnings = []
    if not settings.upstash_redis_rest_url:
        warnings.append("UPSTASH_REDIS_REST_URL not set (Redis disabled)")
    if not settings.langchain_api_key:
        warnings.append("LANGCHAIN_API_KEY not set (tracing disabled)")

    return len(issues) == 0, issues + warnings


def check_database() -> Tuple[bool, str, dict]:
    """Check Supabase database connectivity."""
    try:
        from app.db import get_db

        db = get_db()
        counts = {}

        for table in ["repositories", "reviews", "findings", "settings"]:
            result = db.table(table).select("*", count="exact").limit(0).execute()
            counts[table] = result.count or 0

        message = ", ".join([f"{t}: {c}" for t, c in counts.items()])
        return True, message, counts
    except Exception as e:
        return False, str(e), {}


def check_redis() -> Tuple[bool, str]:
    """Check Upstash Redis connectivity."""
    try:
        from app.config import settings

        if not settings.upstash_redis_rest_url:
            return True, "Redis not configured (optional)"

        from app.services.queue import get_redis_client, QueueService

        redis = get_redis_client()
        queue = QueueService(redis)

        # Test basic operations
        queue_len = queue.queue_length()

        # Test set/get
        redis.set("healthcheck:test", "ok")
        value = redis.get("healthcheck:test")
        redis.delete("healthcheck:test")

        if value != "ok":
            return False, f"Redis read/write failed: got {value}"

        return True, f"Queue length: {queue_len}"
    except Exception as e:
        return False, str(e)


def check_llm() -> Tuple[bool, str, Optional[float]]:
    """Check Gemini LLM connectivity."""
    try:
        from app.services.llm import LLMService

        start = time.time()
        llm = LLMService()
        response = llm.invoke("Reply with exactly: OK")
        duration = time.time() - start

        # Check response contains OK
        if "OK" in response.upper():
            return True, f"Model: {llm.model}", duration
        else:
            return False, f"Unexpected response: {response[:50]}", duration
    except Exception as e:
        return False, str(e), None


def check_github() -> Tuple[bool, str]:
    """Check GitHub API connectivity."""
    try:
        from app.services.github import GitHubService

        gh = GitHubService()

        # Try to fetch a known public repo's PR
        diff = gh.get_pr_diff("octocat", "Hello-World", 1)

        if len(diff) > 0:
            return True, f"Fetched test diff ({len(diff)} chars)"
        else:
            return False, "Empty diff returned"
    except Exception as e:
        return False, str(e)


def check_agents() -> Tuple[bool, str, dict]:
    """Check agent pipeline."""
    try:
        from app.agents.supervisor import ReviewSupervisor

        supervisor = ReviewSupervisor()

        # Simple test diff with obvious security issue
        test_diff = '''diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
@@ -0,0 +1,4 @@
+import os
+
+def run_cmd(cmd):
+    os.system(cmd)
'''

        start = time.time()
        result = supervisor.run(test_diff, ["app.py"])
        duration = time.time() - start

        counts = {
            "logic": len(result["logic_findings"]),
            "security": len(result["security_findings"]),
            "quality": len(result["quality_findings"]),
        }

        total = sum(counts.values())
        message = f"Found {total} findings in {duration:.1f}s"

        # Consider it a pass if we got any response (even 0 findings)
        return True, message, counts
    except Exception as e:
        return False, str(e), {}


def check_worker() -> Tuple[bool, str]:
    """Check worker module functions."""
    try:
        from app.worker.processor import (
            map_agent_severity,
            map_agent_type,
            extract_files_from_diff,
        )
        from app.models.finding import Severity, AgentType

        # Test severity mapping
        assert map_agent_severity("critical") == Severity.CRITICAL
        assert map_agent_severity("warning") == Severity.MEDIUM
        assert map_agent_severity("info") == Severity.INFO

        # Test agent type mapping
        assert map_agent_type("logic") == AgentType.LOGIC
        assert map_agent_type("security") == AgentType.SECURITY
        assert map_agent_type("quality") == AgentType.QUALITY

        # Test diff parsing
        test_diff = "diff --git a/app.py b/app.py\ndiff --git a/utils.py b/utils.py"
        files = extract_files_from_diff(test_diff)
        assert files == ["app.py", "utils.py"]

        return True, "All worker functions OK"
    except AssertionError as e:
        return False, f"Assertion failed: {e}"
    except Exception as e:
        return False, str(e)


def check_rate_limiter() -> Tuple[bool, str]:
    """Check rate limiter functionality."""
    try:
        from app.config import settings

        if not settings.upstash_redis_rest_url:
            return True, "Rate limiter skipped (Redis not configured)"

        from app.services.queue import RateLimiter, get_redis_client

        redis = get_redis_client()
        limiter = RateLimiter(redis, max_requests=15, window_seconds=60)

        remaining = limiter.get_remaining("gemini")
        can_proceed = limiter.can_proceed("gemini")

        return True, f"Remaining: {remaining}/15, Can proceed: {can_proceed}"
    except Exception as e:
        return False, str(e)


def run_health_check(skip_agents: bool = False, quick: bool = False) -> bool:
    """Run all health checks and return overall status.

    Args:
        skip_agents: Skip the agent pipeline test (faster, saves LLM quota)
        quick: Quick mode - skip agents and LLM test
    """
    print_header()

    if quick:
        print(f"  {Colors.YELLOW}Quick mode: Skipping LLM and Agent tests{Colors.END}\n")
    elif skip_agents:
        print(f"  {Colors.YELLOW}Skipping agent pipeline test{Colors.END}\n")

    all_passed = True
    results = []

    # 1. Environment
    print_section("Environment Variables")
    start = time.time()
    passed, issues = check_environment()
    duration = time.time() - start

    if passed and not issues:
        print_check("All required variables set", True, duration=duration)
    elif passed:
        print_check("Required variables set", True, duration=duration)
        for issue in issues:
            print_check(issue, True, "(optional)")
    else:
        all_passed = False
        for issue in issues:
            print_check(issue, False)

    results.append(("Environment", passed))

    # 2. Database
    print_section("Database (Supabase)")
    start = time.time()
    passed, message, counts = check_database()
    duration = time.time() - start
    print_check("Connection", passed, message if not passed else "", duration)
    if passed:
        print_check(f"Tables: {message}", True)
    else:
        all_passed = False
    results.append(("Database", passed))

    # 3. Redis
    print_section("Redis (Upstash)")
    start = time.time()
    passed, message = check_redis()
    duration = time.time() - start
    print_check("Connection", passed, message if not passed else "", duration)
    if passed:
        print_check(message, True)
    results.append(("Redis", passed))

    # 4. LLM
    print_section("LLM Service (Gemini)")
    if quick:
        print_check("Skipped (quick mode)", True)
        results.append(("LLM", True))
    else:
        start = time.time()
        passed, message, llm_duration = check_llm()
        duration = time.time() - start
        print_check("Connection", passed, message if not passed else "", duration)
        if passed:
            print_check(message, True)
            if llm_duration:
                print_check(f"Response time: {llm_duration:.2f}s", True)
        else:
            all_passed = False
        results.append(("LLM", passed))

    # 5. GitHub
    print_section("GitHub API")
    start = time.time()
    passed, message = check_github()
    duration = time.time() - start
    print_check("Connection", passed, message if not passed else "", duration)
    if passed:
        print_check(message, True)
    else:
        all_passed = False
    results.append(("GitHub", passed))

    # 6. Worker Module
    print_section("Worker Module")
    start = time.time()
    passed, message = check_worker()
    duration = time.time() - start
    print_check("Functions", passed, message if not passed else "", duration)
    if passed:
        print_check(message, True)
    else:
        all_passed = False
    results.append(("Worker", passed))

    # 7. Rate Limiter
    print_section("Rate Limiter")
    start = time.time()
    passed, message = check_rate_limiter()
    duration = time.time() - start
    print_check("Status", passed, message if not passed else "", duration)
    if passed:
        print_check(message, True)
    results.append(("Rate Limiter", passed))

    # 8. Agent Pipeline (slower, run last)
    print_section("Agent Pipeline")
    if skip_agents or quick:
        print_check("Skipped (--skip-agents or --quick)", True)
        results.append(("Agents", True))
    else:
        print(f"  {Colors.YELLOW}Running agents (this may take 10-30s)...{Colors.END}")
        start = time.time()
        passed, message, counts = check_agents()
        duration = time.time() - start
        print_check("Supervisor", passed, message if not passed else "", duration)
        if passed:
            print_check(message, True)
            for agent, count in counts.items():
                print_check(f"  {agent.capitalize()} agent: {count} findings", True)
        else:
            all_passed = False
        results.append(("Agents", passed))

    # Summary
    print(f"\n{Colors.BOLD}{'=' * 60}{Colors.END}")
    print(f"{Colors.BOLD}                      SUMMARY{Colors.END}")
    print(f"{'=' * 60}")

    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)

    for name, passed in results:
        icon = f"{Colors.GREEN}PASS{Colors.END}" if passed else f"{Colors.RED}FAIL{Colors.END}"
        print(f"  {name:20} [{icon}]")

    print(f"\n  {Colors.BOLD}Result: {passed_count}/{total_count} checks passed{Colors.END}")

    if all_passed:
        print(f"\n  {Colors.GREEN}{Colors.BOLD}System is healthy and ready to run!{Colors.END}")
        print(f"\n  Start the server with:")
        print(f"    python -m uvicorn app.main:app --reload --port 8000")
    else:
        print(f"\n  {Colors.RED}{Colors.BOLD}Some checks failed. Please fix the issues above.{Colors.END}")

    print()
    return all_passed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="CodeGuard AI - System Health Check",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python healthcheck.py              # Full health check
  python healthcheck.py --skip-agents  # Skip agent test (faster)
  python healthcheck.py --quick        # Quick check (skip LLM and agents)
        """
    )
    parser.add_argument(
        "--skip-agents",
        action="store_true",
        help="Skip the agent pipeline test (saves LLM quota)"
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick mode: skip LLM and agent tests"
    )

    args = parser.parse_args()

    try:
        success = run_health_check(
            skip_agents=args.skip_agents,
            quick=args.quick
        )
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Health check interrupted.{Colors.END}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Health check failed with error: {e}{Colors.END}")
        sys.exit(1)
