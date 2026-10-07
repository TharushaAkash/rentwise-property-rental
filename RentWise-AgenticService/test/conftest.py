"""Shared deterministic fixtures for agent boundary tests."""
import pytest


@pytest.fixture
def matching_input():
    property_id = "11111111-1111-4111-8111-111111111111"
    return {
        "workflowId": "22222222-2222-4222-8222-222222222222",
        "objective": "Find a two bedroom home near Colombo under budget.",
        "request": {"maxMonthlyRent": 150000},
        "candidates": [{
            "id": property_id,
            "status": "Active",
            "monthlyRent": 125000,
            "address": "Colombo 05",
            "bedrooms": 2,
        }],
        "outputs": {},
    }


@pytest.fixture
def matching_output():
    return {
        "propertyId": "11111111-1111-4111-8111-111111111111",
        "summary": "The active two bedroom listing is within the stated budget.",
    }
