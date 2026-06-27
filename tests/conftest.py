"""Shared fixtures for ForgeFlow AI test suite."""
import pytest


@pytest.fixture
def machines():
    """Two active machines: one CNC, one Assembly."""
    return [
        {
            "machine_id": "M-CNC-01",
            "machine_type": "CNC",
            "status": "active",
            "capacity": 100.0,
            "current_load": 0.0,
            "efficiency": 1.0,
        },
        {
            "machine_id": "M-ASM-01",
            "machine_type": "Assembly",
            "status": "active",
            "capacity": 100.0,
            "current_load": 0.0,
            "efficiency": 1.0,
        },
    ]


@pytest.fixture
def inventory():
    """Plentiful stock of common materials."""
    return [
        {"material_name": "steel rod 6mm", "quantity_on_hand": 500.0},
        {"material_name": "aluminum ingot", "quantity_on_hand": 200.0},
        {"material_name": "bearing steel", "quantity_on_hand": 100.0},
    ]


@pytest.fixture
def bom():
    """Minimal BOM covering the test orders plus a deliberately unmatchable product."""
    return {
        "bracket": [{"material": "steel rod 6mm", "quantity_required": 5.0}],
        "bracket assembly": [
            {"material": "steel rod 6mm", "quantity_required": 8.0},
            {"material": "aluminum ingot", "quantity_required": 2.0},
        ],
        "mystery part": [{"material": "unobtainium", "quantity_required": 1.0}],
    }


@pytest.fixture
def orders():
    """Two schedulable orders with distinct urgency, machine type, and due dates."""
    return [
        {
            "order_id": "ORD-001",
            "product_name": "bracket",
            "urgency_score": 7,
            "due_date": "2026-08-01",
            "duration_minutes": 45,
            "machine_type": "CNC",
            "quantity": 10,
        },
        {
            "order_id": "ORD-002",
            "product_name": "bracket assembly",
            "urgency_score": 3,
            "due_date": "2026-09-15",
            "duration_minutes": 60,
            "machine_type": "Assembly",
            "quantity": 5,
        },
    ]


@pytest.fixture
def base_schedule(orders, machines, inventory, bom):
    """A pre-generated schedule used as the starting point in WhatIf tests."""
    from agents.scheduler_agent.production_scheduler import create_production_schedule
    return create_production_schedule(
        orders=orders,
        machines_data=machines,
        inventory_data=inventory,
        bom=bom,
    )
