"""Settings model for per-repository configuration."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.finding import Severity


class AgentsEnabled(BaseModel):
    """Which agents are enabled."""
    logic: bool = True
    security: bool = True
    quality: bool = True


class SettingsBase(BaseModel):
    """Base settings schema."""
    enabled: bool = True
    agents_enabled: AgentsEnabled = Field(default_factory=AgentsEnabled)
    severity_threshold: Severity = Severity.INFO


class SettingsCreate(SettingsBase):
    """Schema for creating settings."""
    repository_id: UUID


class SettingsUpdate(BaseModel):
    """Schema for updating settings."""
    enabled: Optional[bool] = None
    agents_enabled: Optional[AgentsEnabled] = None
    severity_threshold: Optional[Severity] = None


class Settings(SettingsBase):
    """Settings schema with database fields."""
    id: UUID
    repository_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
