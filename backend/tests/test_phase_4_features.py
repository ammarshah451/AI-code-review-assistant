
import pytest
from unittest.mock import MagicMock, patch
from app.worker.processor import process_review
from app.models.review import ReviewStatus
from app.services.github import GitHubService

@pytest.fixture
def mock_dependencies():
    with patch("app.worker.processor.SettingsRepo") as settings_repo, \
         patch("app.worker.processor.RateLimiter") as rate_limiter, \
         patch("app.worker.processor.get_redis_client") as redis, \
         patch("app.worker.processor.GitHubService") as github_service_cls, \
         patch("app.worker.processor.ReviewSupervisor") as supervisor, \
         patch("app.worker.processor.FindingRepo") as finding_repo, \
         patch("app.worker.processor.ReviewRepo") as review_repo, \
         patch("app.worker.processor.get_db") as get_db:
        
        # Setup common mock behavior
        mock_db = MagicMock()
        get_db.return_value = mock_db
        
        mock_review = MagicMock()
        mock_review.repository_id = "repo-123"
        review_repo.get_by_id.return_value.return_value = mock_review
        
        mock_github = MagicMock()
        github_service_cls.return_value = mock_github
        
        mock_settings_repo_inst = MagicMock()
        settings_repo.return_value = mock_settings_repo_inst
        mock_settings_repo_inst.get_by_repository.return_value = None

        rate_limiter.return_value.can_proceed.return_value = True
        
        yield {
            "github": mock_github,
            "review_repo": review_repo.return_value,
            "supervisor": supervisor.return_value,
            "finding_repo": finding_repo.return_value
        }

def test_context_aware_review_fetches_content(mock_dependencies):
    """Verify that file content is fetched and passed to supervisor."""
    mocks = mock_dependencies
    mocks["github"].get_pr_diff.return_value = "diff --git a/test.py b/test.py\nnew file mode 100644\n--- /dev/null\n+++ b/test.py\n@@ -0,0 +1 @@\n+print('hello')"
    mocks["github"].get_file_content.side_effect = [
        None, # .codeguardignore (not found)
        "print('hello')\n" # test.py content
    ]
    
    mocks["supervisor"].run.return_value = {
        "logic_findings": [], "security_findings": [], "quality_findings": [], "final_comment": "LGTM"
    }

    job_data = {
        "review_id": "550e8400-e29b-41d4-a716-446655440000",
        "owner": "owner",
        "repo": "repo",
        "pr_number": 1,
        "commit_sha": "sha"
    }
    
    process_review(job_data)
    
    # Verify .codeguardignore was checked (called with keyword ref)
    mocks["github"].get_file_content.assert_any_call("owner", "repo", ".codeguardignore", ref="sha")
    
    # Verify file content was fetched (called with positional ref in _fetch_file_contents)
    mocks["github"].get_file_content.assert_any_call("owner", "repo", "test.py", "sha")
    
    # Verify supervisor received file contents
    args, _ = mocks["supervisor"].run.call_args
    assert args[0] == mocks["github"].get_pr_diff.return_value
    assert args[1] == ["test.py"]
    assert args[2] == {"test.py": "print('hello')\n"}
    from uuid import UUID
    
def test_diff_content_is_saved(mock_dependencies):
    """Verify that the raw diff is saved to the review record."""
    mocks = mock_dependencies
    diff_content = "diff --git a/test.py b/test.py..."
    mocks["github"].get_pr_diff.return_value = diff_content
    mocks["github"].get_file_content.return_value = "" # Default empty content avoiding side_effect issues
    
    mocks["supervisor"].run.return_value = {
        "logic_findings": [], "security_findings": [], "quality_findings": [], "final_comment": "LGTM"
    }

    job_data = {
        "review_id": "550e8400-e29b-41d4-a716-446655440000",
        "owner": "owner",
        "repo": "repo",
        "pr_number": 1,
        "commit_sha": "sha"
    }
    
    process_review(job_data)
    
    from uuid import UUID
    # Verify update_diff was called
    mocks["review_repo"].update_diff.assert_called_once_with(
        UUID("550e8400-e29b-41d4-a716-446655440000"), 
        diff_content
    )

def test_codeguardignore_filtering(mock_dependencies):
    """Verify that files matching .codeguardignore are filtered out."""
    mocks = mock_dependencies
    
    # multiple files in diff
    diff_content = """diff --git a/app.py b/app.py
index 123..456 100644
--- a/app.py
+++ b/app.py
@@ -1 +1 @@
-old
+new
diff --git a/ignored.txt b/ignored.txt
index 123..456 100644
--- a/ignored.txt
+++ b/ignored.txt
@@ -1 +1 @@
-ignore
+me
"""
    mocks["github"].get_pr_diff.return_value = diff_content
    
    # Return .codeguardignore content then file content
    mocks["github"].get_file_content.side_effect = [
        "*.txt\n", # .codeguardignore
        "content"  # app.py content (ignored.txt shouldn't be fetched if filtered correctly?)
                   # Actually processor fetches ignore file, parses it, then filters diff and files list.
                   # Then it fetches content only for filtered files.
    ]
    
    mocks["supervisor"].run.return_value = {
        "logic_findings": [], "security_findings": [], "quality_findings": [], "final_comment": "LGTM"
    }

    job_data = {
        "review_id": "550e8400-e29b-41d4-a716-446655440000",
        "owner": "owner",
        "repo": "repo",
        "pr_number": 1,
        "commit_sha": "sha"
    }
    
    process_review(job_data)
    
    # Verify supervisor only got app.py
    args, _ = mocks["supervisor"].run.call_args
    assert "ignored.txt" not in args[1]
    assert "app.py" in args[1]
    
    # Verify content was not fetched for ignored file
    # get_file_content calls: 1. .codeguardignore, 2. app.py
    # We expect exactly 2 calls or at least NOT ignored.txt
    call_args_list = mocks["github"].get_file_content.call_args_list
    fetched_files = [c[0][2] for c in call_args_list]
    assert ".codeguardignore" in fetched_files
    assert "app.py" in fetched_files
    assert "ignored.txt" not in fetched_files

