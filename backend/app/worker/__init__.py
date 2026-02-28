"""Background worker for processing PR reviews."""

from app.worker.processor import process_review

__all__ = ["process_review"]
