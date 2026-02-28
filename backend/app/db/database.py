"""Supabase database client setup."""

from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_supabase_client() -> Client:
    """Get cached Supabase client instance."""
    if not settings.supabase_url or not settings.supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

    return create_client(settings.supabase_url, settings.supabase_key)


def get_db() -> Client:
    """Dependency for getting database client."""
    return get_supabase_client()
