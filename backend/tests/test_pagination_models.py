"""Tests for pagination models."""

import pytest
from pydantic import ValidationError

from app.models.pagination import PaginatedResponse, PaginationParams


class TestPaginationParams:
    """Tests for PaginationParams model."""

    def test_default_values(self):
        """Test default values for pagination params."""
        params = PaginationParams()

        assert params.page == 1
        assert params.per_page == 20

    def test_custom_values(self):
        """Test custom values for pagination params."""
        params = PaginationParams(page=3, per_page=50)

        assert params.page == 3
        assert params.per_page == 50

    def test_offset_calculation(self):
        """Test offset property calculation."""
        # Page 1 with 20 items per page -> offset 0
        params1 = PaginationParams(page=1, per_page=20)
        assert params1.offset == 0

        # Page 2 with 20 items per page -> offset 20
        params2 = PaginationParams(page=2, per_page=20)
        assert params2.offset == 20

        # Page 3 with 10 items per page -> offset 20
        params3 = PaginationParams(page=3, per_page=10)
        assert params3.offset == 20

        # Page 5 with 25 items per page -> offset 100
        params4 = PaginationParams(page=5, per_page=25)
        assert params4.offset == 100

    def test_page_minimum_is_one(self):
        """Test that page must be at least 1."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationParams(page=0)

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("page",)

    def test_per_page_maximum(self):
        """Test that per_page cannot exceed 100."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationParams(per_page=101)

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("per_page",)

        # Also test that 100 is allowed
        params = PaginationParams(per_page=100)
        assert params.per_page == 100


class TestPaginatedResponse:
    """Tests for PaginatedResponse model."""

    def test_create_paginated_response(self):
        """Test creating a paginated response."""
        items = ["item1", "item2", "item3"]
        response = PaginatedResponse[str](
            items=items,
            total=10,
            page=1,
            per_page=3,
            pages=4,
        )

        assert response.items == items
        assert response.total == 10
        assert response.page == 1
        assert response.per_page == 3
        assert response.pages == 4

    def test_has_next_and_prev(self):
        """Test has_next and has_prev properties for middle page."""
        response = PaginatedResponse[int](
            items=[4, 5, 6],
            total=9,
            page=2,
            per_page=3,
            pages=3,
        )

        assert response.has_next is True
        assert response.has_prev is True

    def test_first_page_no_prev(self):
        """Test that first page has no previous page."""
        response = PaginatedResponse[int](
            items=[1, 2, 3],
            total=9,
            page=1,
            per_page=3,
            pages=3,
        )

        assert response.has_next is True
        assert response.has_prev is False

    def test_last_page_no_next(self):
        """Test that last page has no next page."""
        response = PaginatedResponse[int](
            items=[7, 8, 9],
            total=9,
            page=3,
            per_page=3,
            pages=3,
        )

        assert response.has_next is False
        assert response.has_prev is True
