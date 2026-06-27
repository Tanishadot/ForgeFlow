"""Tests for the core AgentIQ scheduling pipeline.

create_production_schedule() orchestrates:
  OrderPrioritizerAgent → InventoryAgent (BOM) → MachineAgent → Scheduler
"""
import pytest
from agents.scheduler_agent.production_scheduler import create_production_schedule


# ── helpers ───────────────────────────────────────────────────────────────────

def _order(order_id, product, urgency, due_date, duration=30, machine_type=None, quantity=1):
    o = {
        "order_id": order_id,
        "product_name": product,
        "urgency_score": urgency,
        "due_date": due_date,
        "duration_minutes": duration,
        "quantity": quantity,
    }
    if machine_type:
        o["machine_type"] = machine_type
    return o


# ── Tier-1 tests ──────────────────────────────────────────────────────────────

def test_empty_orders_returns_empty_list(machines, inventory, bom):
    result = create_production_schedule(
        orders=[], machines_data=machines, inventory_data=inventory, bom=bom
    )
    assert result == []


def test_high_urgency_scheduled_before_low_urgency(machines, inventory, bom):
    """With identical far-future due dates, urgency_score decides the order."""
    orders = [
        _order("LOW",  "bracket", urgency=1, due_date="2028-01-01"),
        _order("HIGH", "bracket", urgency=9, due_date="2028-01-01"),
    ]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    assert len(result) == 2
    assert result[0]["order"] == "HIGH", (
        f"Expected HIGH first, got {[r['order'] for r in result]}"
    )


def test_missing_inventory_blocks_order(machines, inventory, bom):
    """An order whose required material is absent from inventory gets status=blocked."""
    orders = [_order("GHOST", "mystery part", urgency=5, due_date="2026-08-01")]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    assert len(result) == 1
    assert result[0]["status"] == "blocked"
    assert result[0]["order"] == "GHOST"


def test_all_machines_down_blocks_all_orders(machines, inventory, bom):
    """When every machine is down, every order must be blocked (no machine to assign)."""
    down_machines = [{**m, "status": "down"} for m in machines]
    orders = [
        _order("O1", "bracket", urgency=8, due_date="2026-08-01", machine_type="CNC"),
        _order("O2", "bracket assembly", urgency=4, due_date="2026-09-01", machine_type="Assembly"),
    ]
    result = create_production_schedule(
        orders=orders, machines_data=down_machines, inventory_data=inventory, bom=bom
    )
    assert len(result) == 2
    assert all(r["status"] in ("blocked", "delayed", "error") for r in result)


def test_scheduled_order_has_machine_and_times(machines, inventory, bom):
    """A successfully scheduled order must have a machine, start, and end."""
    orders = [_order("O1", "bracket", urgency=5, due_date="2026-08-01", machine_type="CNC")]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    assert len(result) == 1
    item = result[0]
    assert item.get("status") not in ("blocked", "error"), f"Expected scheduled, got {item}"
    assert item["machine"] is not None
    assert item["start"] is not None
    assert item["end"] is not None


def test_orders_without_bom_match_still_schedule(machines, inventory):
    """Orders with no BOM entry are not inventory-checked and proceed to machine assignment."""
    blank_bom: dict = {}
    orders = [_order("O1", "uncatalogued widget", urgency=5, due_date="2026-08-01")]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=blank_bom
    )
    assert len(result) == 1
    assert result[0].get("status") != "blocked"


def test_two_orders_use_correct_machines(machines, inventory, bom):
    """Each order is assigned to a machine matching its machine_type."""
    orders = [
        _order("CNC-JOB",  "bracket",          urgency=5, due_date="2026-08-01", machine_type="CNC"),
        _order("ASM-JOB",  "bracket assembly",  urgency=5, due_date="2026-08-01", machine_type="Assembly"),
    ]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=inventory, bom=bom
    )
    by_order = {r["order"]: r for r in result}
    assert by_order["CNC-JOB"]["machine"] == "M-CNC-01"
    assert by_order["ASM-JOB"]["machine"] == "M-ASM-01"


def test_sufficient_inventory_allows_scheduling(machines, bom):
    """Order is scheduled (not blocked) when inventory covers the BOM requirement."""
    plentiful = [{"material_name": "steel rod 6mm", "quantity_on_hand": 1000.0}]
    orders = [_order("O1", "bracket", urgency=5, due_date="2026-08-01")]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=plentiful, bom=bom
    )
    assert result[0].get("status") != "blocked"


def test_zero_inventory_blocks_order(machines, bom):
    """Order is blocked when inventory quantity is exactly 0."""
    empty = [{"material_name": "steel rod 6mm", "quantity_on_hand": 0.0}]
    orders = [_order("O1", "bracket", urgency=5, due_date="2026-08-01")]
    result = create_production_schedule(
        orders=orders, machines_data=machines, inventory_data=empty, bom=bom
    )
    assert result[0]["status"] == "blocked"
