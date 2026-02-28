"""Repository pattern for database operations."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from supabase import Client

from app.models import (
    Finding,
    FindingCreate,
    Repository,
    RepositoryCreate,
    Review,
    ReviewCreate,
    ReviewStatus,
    Settings,
    SettingsCreate,
    SettingsUpdate,
)


class RepositoryRepo:
    """Repository operations for GitHub repositories."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "repositories"

    def create(self, data: RepositoryCreate) -> Repository:
        """Create a new repository."""
        result = (
            self.client.table(self.table)
            .insert(data.model_dump())
            .execute()
        )
        return Repository(**result.data[0])

    def get_by_id(self, id: UUID) -> Optional[Repository]:
        """Get repository by ID."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("id", str(id))
            .execute()
        )
        if result.data:
            return Repository(**result.data[0])
        return None

    def get_by_github_id(self, github_id: int) -> Optional[Repository]:
        """Get repository by GitHub ID."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("github_id", github_id)
            .execute()
        )
        if result.data:
            return Repository(**result.data[0])
        return None

    def get_all(self) -> List[Repository]:
        """Get all repositories."""
        result = self.client.table(self.table).select("*").execute()
        return [Repository(**row) for row in result.data]

    def delete(self, id: UUID) -> bool:
        """Delete a repository."""
        result = (
            self.client.table(self.table)
            .delete()
            .eq("id", str(id))
            .execute()
        )
        return len(result.data) > 0

    def get_all_paginated(
        self, offset: int = 0, limit: int = 20
    ) -> tuple[List[Repository], int]:
        """Get paginated repositories with total count."""
        # Get paginated data
        result = (
            self.client.table(self.table)
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        repositories = [Repository(**row) for row in result.data]

        # Get total count
        count_result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        total = count_result.count or 0

        return (repositories, total)

    def count_all(self) -> int:
        """Count all repositories."""
        result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        return result.count or 0


class ReviewRepo:
    """Repository operations for PR reviews."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "reviews"

    def create(self, data: ReviewCreate) -> Review:
        """Create a new review."""
        insert_data = data.model_dump()
        insert_data["repository_id"] = str(data.repository_id)
        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return Review(**result.data[0])

    def get_by_id(self, id: UUID) -> Optional[Review]:
        """Get review by ID."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("id", str(id))
            .execute()
        )
        if result.data:
            return Review(**result.data[0])
        return None

    def get_by_repository(
        self, repository_id: UUID, limit: int = 50
    ) -> List[Review]:
        """Get reviews for a repository."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("repository_id", str(repository_id))
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [Review(**row) for row in result.data]

    def update_status(
        self, id: UUID, status: ReviewStatus, comment_id: Optional[int] = None
    ) -> Optional[Review]:
        """Update review status."""
        update_data = {"status": status.value}
        if comment_id is not None:
            update_data["comment_id"] = comment_id
        if status == ReviewStatus.COMPLETED:
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            self.client.table(self.table)
            .update(update_data)
            .eq("id", str(id))
            .execute()
        )
        if result.data:
            return Review(**result.data[0])
        return None

    def update_diff(self, id: UUID, diff_content: str) -> None:
        """Store the PR diff content on the review record.

        Args:
            id: Review UUID
            diff_content: The unified diff text to store
        """
        self.client.table(self.table).update(
            {"diff_content": diff_content}
        ).eq("id", str(id)).execute()

    def get_all_paginated(
        self, offset: int = 0, limit: int = 20
    ) -> tuple[List[Review], int]:
        """Get paginated reviews with total count."""
        # Get paginated data
        result = (
            self.client.table(self.table)
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        reviews = [Review(**row) for row in result.data]

        # Get total count
        count_result = (
            self.client.table(self.table)
            .select("*", count="exact")
            .execute()
        )
        total = count_result.count or 0

        return (reviews, total)

    def count_all(self) -> int:
        """Count all reviews."""
        result = (
            self.client.table(self.table)
            .select("id", count="exact")
            .execute()
        )
        return result.count or 0

    def count_by_status(self) -> dict[str, int]:
        """Count reviews grouped by status.

        Uses minimal select (id only) for efficiency.
        """
        counts = {"pending": 0, "processing": 0, "completed": 0, "failed": 0}
        for status in counts.keys():
            result = (
                self.client.table(self.table)
                .select("id", count="exact")
                .eq("status", status)
                .execute()
            )
            counts[status] = result.count or 0
        return counts


class FindingRepo:
    """Repository operations for review findings."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "findings"

    def create(self, data: FindingCreate) -> Finding:
        """Create a new finding."""
        insert_data = data.model_dump()
        insert_data["review_id"] = str(data.review_id)
        insert_data["agent_type"] = data.agent_type.value
        insert_data["severity"] = data.severity.value
        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return Finding(**result.data[0])

    def create_many(self, findings: List[FindingCreate]) -> List[Finding]:
        """Create multiple findings."""
        if not findings:
            return []
        insert_data = []
        for f in findings:
            d = f.model_dump()
            d["review_id"] = str(f.review_id)
            d["agent_type"] = f.agent_type.value
            d["severity"] = f.severity.value
            insert_data.append(d)

        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return [Finding(**row) for row in result.data]

    def get_by_review(self, review_id: UUID) -> List[Finding]:
        """Get all findings for a review."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("review_id", str(review_id))
            .order("severity")
            .execute()
        )
        return [Finding(**row) for row in result.data]

    def mark_false_positive(
        self, finding_id: UUID, is_false_positive: bool, reason: Optional[str] = None
    ) -> Optional[Finding]:
        """Mark a finding as false positive.

        Args:
            finding_id: The finding ID to update
            is_false_positive: Whether to mark as false positive
            reason: Optional reason for marking

        Returns:
            Updated Finding or None if not found
        """
        update_data = {
            "is_false_positive": is_false_positive,
            "false_positive_reason": reason if is_false_positive else None,
        }

        result = (
            self.client.table(self.table)
            .update(update_data)
            .eq("id", str(finding_id))
            .execute()
        )

        if result.data:
            return Finding(**result.data[0])
        return None


class SettingsRepo:
    """Repository operations for repository settings."""

    def __init__(self, client: Client):
        self.client = client
        self.table = "settings"

    def create(self, data: SettingsCreate) -> Settings:
        """Create settings for a repository."""
        insert_data = data.model_dump()
        insert_data["repository_id"] = str(data.repository_id)
        insert_data["agents_enabled"] = data.agents_enabled.model_dump()
        insert_data["severity_threshold"] = data.severity_threshold.value
        result = (
            self.client.table(self.table)
            .insert(insert_data)
            .execute()
        )
        return Settings(**result.data[0])

    def get_by_repository(self, repository_id: UUID) -> Optional[Settings]:
        """Get settings for a repository."""
        result = (
            self.client.table(self.table)
            .select("*")
            .eq("repository_id", str(repository_id))
            .execute()
        )
        if result.data:
            return Settings(**result.data[0])
        return None

    def update(
        self, repository_id: UUID, data: SettingsUpdate
    ) -> Optional[Settings]:
        """Update repository settings."""
        update_data = data.model_dump(exclude_unset=True)
        # agents_enabled is already serialized by model_dump(), no need to call model_dump() again
        # severity_threshold is already a string after model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            self.client.table(self.table)
            .update(update_data)
            .eq("repository_id", str(repository_id))
            .execute()
        )
        if result.data:
            return Settings(**result.data[0])
        return None

    def get_or_create(self, repository_id: UUID) -> Settings:
        """Get settings or create default if not exists."""
        existing = self.get_by_repository(repository_id)
        if existing:
            return existing
        return self.create(SettingsCreate(repository_id=repository_id))
