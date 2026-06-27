"""Tests for the WhatIf simulation service.

All three scenario types (machine_failure, rush_order, inventory_reduction)
rerun the full AgentIQ pipeline and return a new_schedule in the impact block.
"""
import pytest
from services.what_if_simulation_service import WhatIfSimulationService
from agents.scheduler_agent.production_scheduler import create_production_schedule


# ── helpers ───────────────────────────────────────────────────────────────────

def _simulate(schedule, machines, inventory, scenario, orders, bom):
    return WhatIfSimulationService.simulate(
        schedule=schedule,
        machines=machines,
        inventory=inventory,
        scenario=scenario,
        orders=orders,
        bom=bom,
    )


# ── machine_failure ───────────────────────────────────────────────────────────

def test_machine_failure_excludes_failed_machine(machines, inventory, bom):
    """After a machine failure no scheduled item should use the failed machine."""
    orders = [
        {
            "order_id": "CNC-JOB",
            "product_name": "bracket",
            "urgency_score": 5,
            "due_date": "2026-08-01",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        }
    ]
    base = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    result = _simulate(
        schedule=base,
        machines=machines,
        inventory=inventory,
        scenario={"type": "machine_failure", "machine": "M-CNC-01"},
        orders=orders,
        bom=bom,
    )
    assert result["status"] == "success"
    new = result["impact"]["new_schedule"]
    machines_used = [r.get("machine") for r in new if r.get("machine")]
    assert "M-CNC-01" not in machines_used, (
        f"Failed machine M-CNC-01 still appears in new schedule: {new}"
    )


def test_machine_failure_blocks_order_with_no_fallback(machines, inventory, bom):
    """If only one machine can handle the order type and it fails, order is blocked."""
    orders = [
        {
            "order_id": "CNC-ONLY",
            "product_name": "bracket",
            "urgency_score": 5,
            "due_date": "2026-08-01",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        }
    ]
    base = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    result = _simulate(
        schedule=base,
        machines=machines,
        inventory=inventory,
        scenario={"type": "machine_failure", "machine": "M-CNC-01"},
        orders=orders,
        bom=bom,
    )
    new = result["impact"]["new_schedule"]
    statuses = [r.get("status", "scheduled") for r in new]
    assert any(s in ("blocked", "delayed") for s in statuses), (
        f"Expected at least one blocked/delayed order, got: {statuses}"
    )


def test_machine_failure_missing_machine_key_returns_error(base_schedule, machines, inventory, bom, orders):
    """Missing 'machine' key in scenario returns an error response."""
    result = _simulate(
        schedule=base_schedule,
        machines=machines,
        inventory=inventory,
        scenario={"type": "machine_failure"},   # no 'machine' key
        orders=orders,
        bom=bom,
    )
    assert result["status"] == "error"
    assert result["errors"]


def test_machine_failure_missing_orders_returns_error(base_schedule, machines, inventory, bom):
    """machine_failure requires orders to be passed to rerun the pipeline."""
    result = _simulate(
        schedule=base_schedule,
        machines=machines,
        inventory=inventory,
        scenario={"type": "machine_failure", "machine": "M-CNC-01"},
        orders=None,   # deliberately omitted
        bom=bom,
    )
    assert result["status"] == "error"


# ── rush_order ────────────────────────────────────────────────────────────────

def test_rush_order_appears_in_new_schedule(machines, inventory, bom):
    """Rush order (urgency=10, due=today) must appear in the new schedule."""
    base_orders = [
        {
            "order_id": "LAZY",
            "product_name": "bracket",
            "urgency_score": 1,
            "due_date": "2028-01-01",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        }
    ]
    base = create_production_schedule(
        orders=base_orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    rush_scenario = {
        "type": "rush_order",
        "order": {
            "order_id": "RUSH-001",
            "product_name": "bracket",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        },
    }
    result = _simulate(
        schedule=base,
        machines=machines,
        inventory=inventory,
        scenario=rush_scenario,
        orders=base_orders,
        bom=bom,
    )
    assert result["status"] == "success"
    new = result["impact"]["new_schedule"]
    order_ids = [r.get("order", "") for r in new]
    assert any("RUSH" in oid for oid in order_ids), (
        f"Rush order not found in new schedule: {order_ids}"
    )


def test_rush_order_with_max_urgency_scheduled_first(machines, inventory, bom):
    """Rush order must be first when all competing orders have low urgency and far dates."""
    base_orders = [
        {
            "order_id": "LAZY",
            "product_name": "bracket",
            "urgency_score": 1,
            "due_date": "2028-01-01",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        }
    ]
    base = create_production_schedule(
        orders=base_orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    rush_scenario = {
        "type": "rush_order",
        "order": {
            "order_id": "RUSH-MAX",
            "product_name": "bracket",
            "duration_minutes": 20,
            "machine_type": "CNC",
            "quantity": 1,
        },
    }
    result = _simulate(
        schedule=base,
        machines=machines,
        inventory=inventory,
        scenario=rush_scenario,
        orders=base_orders,
        bom=bom,
    )
    new = result["impact"]["new_schedule"]
    first_id = new[0].get("order", "")
    assert "RUSH" in first_id, (
        f"Expected RUSH order first, got '{first_id}'. Full schedule: {[r['order'] for r in new]}"
    )


def test_rush_order_missing_order_payload_returns_error(base_schedule, machines, inventory, bom, orders):
    """rush_order without a 'order' key in scenario returns an error."""
    result = _simulate(
        schedule=base_schedule,
        machines=machines,
        inventory=inventory,
        scenario={"type": "rush_order"},   # no 'order' key
        orders=orders,
        bom=bom,
    )
    assert result["status"] == "error"


# ── inventory_reduction ───────────────────────────────────────────────────────

def test_inventory_reduction_blocks_previously_ok_order(machines, inventory, bom):
    """Reducing material to zero should block the order that needed it."""
    orders = [
        {
            "order_id": "BRACKET-RUN",
            "product_name": "bracket",
            "urgency_score": 5,
            "due_date": "2026-08-01",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        }
    ]
    base = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    # Confirm the order was originally scheduled
    assert base[0].get("status") not in ("blocked", "error"), \
        "Base order should be scheduled before inventory reduction"

    result = _simulate(
        schedule=base,
        machines=machines,
        inventory=inventory,
        scenario={
            "type": "inventory_reduction",
            "product_id": "steel rod 6mm",
            "reduction": 500,   # wipe out all 500 units
        },
        orders=orders,
        bom=bom,
    )
    assert result["status"] == "success"
    new = result["impact"]["new_schedule"]
    assert any(r.get("status") == "blocked" for r in new), (
        f"Expected a blocked order after inventory wipeout, got: {[r.get('status') for r in new]}"
    )


def test_inventory_reduction_partial_leaves_order_ok(machines, bom):
    """A small reduction that leaves sufficient stock should not block the order."""
    # bracket needs 5 units; give 100, reduce by 10 → 90 remain → still OK
    plentiful = [{"material_name": "steel rod 6mm", "quantity_on_hand": 100.0}]
    orders = [
        {
            "order_id": "O1",
            "product_name": "bracket",
            "urgency_score": 5,
            "due_date": "2026-08-01",
            "duration_minutes": 30,
            "machine_type": "CNC",
            "quantity": 1,
        }
    ]
    base = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=plentiful, bom=bom
    )
    result = _simulate(
        schedule=base,
        machines=machines,
        inventory=plentiful,
        scenario={"type": "inventory_reduction", "product_id": "steel rod 6mm", "reduction": 10},
        orders=orders,
        bom=bom,
    )
    assert result["status"] == "success"
    new = result["impact"]["new_schedule"]
    assert all(r.get("status") not in ("blocked",) for r in new), (
        "Small reduction should not block order"
    )


# ── unknown scenario ──────────────────────────────────────────────────────────

def test_unknown_scenario_type_returns_error(base_schedule, machines, inventory, bom, orders):
    result = _simulate(
        schedule=base_schedule,
        machines=machines,
        inventory=inventory,
        scenario={"type": "teleportation"},
        orders=orders,
        bom=bom,
    )
    assert result["status"] == "error"
    assert "Unknown scenario type" in str(result.get("errors", []))
