"""Finding model for individual review findings."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AgentType(str, Enum):
    """Agent type enum."""
    LOGIC = "logic"
    SECURITY = "security"
    QUALITY = "quality"


class Severity(str, Enum):
    """Severity level enum."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingBase(BaseModel):
    """Base finding schema."""
    agent_type: AgentType
    severity: Severity
    file_path: str
    line_number: Optional[int] = None
    title: str
    description: str
    suggestion: Optional[str] = None
    confidence: str = "medium"
    is_false_positive: bool = False
    false_positive_reason: Optional[str] = None


class FindingCreate(FindingBase):
    """Schema for creating a finding."""
    review_id: UUID


class Finding(FindingBase):
    """Finding schema with database fields."""
    id: UUID
    review_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
