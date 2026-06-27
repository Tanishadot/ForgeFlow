"""What-If simulation service for production schedules.

All three scenario types rerun the full AgentIQ pipeline so results are
consistent with the main schedule: OrderPrioritizerAgent → InventoryAgent
(BOM) → MachineAgent → Scheduler.
"""

from __future__ import annotations

from datetime import date, datetime
import logging
from typing import Any

logger = logging.getLogger(__name__)


class WhatIfSimulationService:
    """Simulate what-if scenarios against a schedule."""

    @classmethod
    def simulate(
        cls,
        schedule: list[dict[str, Any]],
        machines: list[dict[str, Any]] | None,
        inventory: list[dict[str, Any]] | None,
        scenario: dict[str, Any],
        orders: list[dict[str, Any]] | None = None,
        bom: dict[str, list[dict[str, Any]]] | None = None,
    ) -> dict[str, Any]:
        stype = scenario.get("type")
        if stype == "machine_failure":
            return cls._simulate_machine_failure(
                schedule, machines or [], scenario,
                orders=orders, inventory=inventory, bom=bom,
            )
        if stype == "inventory_reduction":
            return cls._simulate_inventory_reduction(
                schedule, inventory or [], scenario,
                orders=orders, machines=machines, bom=bom,
            )
        if stype == "rush_order":
            return cls._simulate_rush_order(
                schedule, machines or [], scenario,
                orders=orders, inventory=inventory, bom=bom,
            )
        return {"status": "error", "errors": [f"Unknown scenario type: {stype}"]}

    @staticmethod
    def _parse_dt(value: Any) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value))
        except Exception:
            return None

    @staticmethod
    def _duration_minutes(start: Any, end: Any) -> float:
        s = WhatIfSimulationService._parse_dt(start)
        e = WhatIfSimulationService._parse_dt(end)
        if not s or not e:
            return 0.0
        return max(0.0, (e - s).total_seconds() / 60.0)

    @classmethod
    def _compute_utilization(cls, schedule: list[dict[str, Any]]) -> dict[str, float]:
        util: dict[str, float] = {}
        for item in schedule:
            m = item.get("machine")
            if not m:
                continue
            dur = cls._duration_minutes(item.get("start"), item.get("end"))
            util[m] = util.get(m, 0.0) + dur
        return util

    @classmethod
    def _util_changes(
        cls,
        original: list[dict[str, Any]],
        new: list[dict[str, Any]],
    ) -> dict[str, dict[str, float]]:
        orig = cls._compute_utilization(original)
        updated = cls._compute_utilization(new)
        return {
            m: {"before": orig.get(m, 0.0), "after": updated.get(m, 0.0)}
            for m in set(list(orig) + list(updated))
        }

    @classmethod
    def _simulate_machine_failure(
        cls,
        schedule: list[dict[str, Any]],
        machines: list[dict[str, Any]],
        scenario: dict[str, Any],
        orders: list[dict[str, Any]] | None = None,
        inventory: list[dict[str, Any]] | None = None,
        bom: dict[str, list[dict[str, Any]]] | None = None,
    ) -> dict[str, Any]:
        """Mark the machine as down and rerun the full scheduling pipeline."""
        from agents.scheduler_agent.production_scheduler import create_production_schedule
        from services.bom_service import load_bom

        failed = scenario.get("machine")
        if not failed:
            return {"status": "error", "errors": ["scenario.machine is required for machine_failure"]}
        if not orders:
            return {"status": "error", "errors": ["orders must be included in the what-if request for machine_failure"]}

        # Mark the failed machine as down
        modified_machines = [
            {**m, "status": "down"} if (m.get("machine_id") or m.get("machine")) == failed else dict(m)
            for m in machines
        ]

        effective_bom = bom if bom is not None else load_bom()
        new_schedule = create_production_schedule(
            orders=orders,
            machines_data=modified_machines,
            inventory_data=inventory,
            bom=effective_bom,
        )

        # Classify each order: blocked, delayed, or successfully rerouted
        original_items = {s.get("order"): s for s in schedule}
        affected: list[dict[str, Any]] = []
        schedule_changes: list[dict[str, Any]] = []

        for item in new_schedule:
            oid = item.get("order")
            orig = original_items.get(oid, {})
            old_status   = orig.get("status", "scheduled")
            new_status   = item.get("status", "scheduled")
            orig_machine = orig.get("machine")
            new_machine  = item.get("machine")

            if new_status in ("blocked", "delayed") and old_status not in ("blocked", "delayed"):
                affected.append({"order": oid, "was": old_status, "now": new_status, "reason": item.get("reason")})
                schedule_changes.append({"order": oid, "from": failed, "to": None})
            elif orig_machine == failed and new_machine and new_machine != failed:
                affected.append({
                    "order": oid,
                    "was": f"on {failed}",
                    "now": f"rerouted to {new_machine}",
                    "reason": "machine_failure",
                })
                schedule_changes.append({"order": oid, "from": failed, "to": new_machine})

        delayed_orders = [
            a["order"] for a in affected
            if isinstance(a.get("now"), str) and a["now"] in ("blocked", "delayed")
        ]

        return {
            "status": "success",
            "scenario": {"type": "machine_failure", "machine": failed},
            "impact": {
                "delayed_orders": delayed_orders,
                "schedule_changes": schedule_changes,
                "utilization_changes": cls._util_changes(schedule, new_schedule),
                "new_schedule": new_schedule,
                "affected_orders": affected,
            },
            "errors": [],
        }

    @classmethod
    def _simulate_inventory_reduction(
        cls,
        schedule: list[dict[str, Any]],
        inventory: list[dict[str, Any]],
        scenario: dict[str, Any],
        orders: list[dict[str, Any]] | None = None,
        machines: list[dict[str, Any]] | None = None,
        bom: dict[str, list[dict[str, Any]]] | None = None,
    ) -> dict[str, Any]:
        """Reduce the specified material and rerun the full scheduling pipeline."""
        pid = scenario.get("product_id") or scenario.get("material")
        reduction = float(scenario.get("reduction", 0))

        if not pid:
            return {"status": "error", "errors": ["scenario.product_id is required for inventory_reduction"]}
        if not orders:
            return {"status": "error", "errors": ["orders must be included in the what-if request for inventory_reduction"]}

        pid_lower = str(pid).strip().lower()
        modified_inventory: list[dict[str, Any]] = []
        for item in inventory:
            copy = dict(item)
            item_name = str(copy.get("material_name") or "").strip().lower()
            item_pid  = str(copy.get("product_id")   or "").strip().lower()
            if item_name == pid_lower or item_pid == pid_lower:
                old_qty = float(copy.get("quantity_on_hand", 0))
                new_qty = max(0.0, old_qty - reduction)
                copy["quantity_on_hand"] = new_qty
                copy["quantity"]         = new_qty
            modified_inventory.append(copy)

        from agents.scheduler_agent.production_scheduler import create_production_schedule
        from services.bom_service import load_bom
        effective_bom = bom if bom is not None else load_bom()

        new_schedule = create_production_schedule(
            orders=orders,
            machines_data=machines,
            inventory_data=modified_inventory,
            bom=effective_bom,
        )

        original_status = {s.get("order"): s.get("status", "scheduled") for s in schedule}
        affected: list[dict[str, Any]] = []
        for item in new_schedule:
            oid        = item.get("order")
            new_status = item.get("status", "scheduled")
            old_status = original_status.get(oid, "scheduled")
            if new_status in ("blocked", "delayed") and old_status not in ("blocked", "delayed"):
                affected.append({
                    "order":  oid,
                    "was":    old_status,
                    "now":    new_status,
                    "reason": item.get("reason", "inventory shortage"),
                })

        delayed_orders = [a["order"] for a in affected]
        schedule_changes = [{"order": a["order"], "reason": a.get("reason")} for a in affected]

        return {
            "status": "success",
            "scenario": {"type": "inventory_reduction", "product_id": pid, "reduction": reduction},
            "impact": {
                "delayed_orders": delayed_orders,
                "schedule_changes": schedule_changes,
                "utilization_changes": cls._util_changes(schedule, new_schedule),
                "new_schedule": new_schedule,
                "affected_orders": affected,
            },
            "errors": [],
        }

    @classmethod
    def _simulate_rush_order(
        cls,
        schedule: list[dict[str, Any]],
        machines: list[dict[str, Any]],
        scenario: dict[str, Any],
        orders: list[dict[str, Any]] | None = None,
        inventory: list[dict[str, Any]] | None = None,
        bom: dict[str, list[dict[str, Any]]] | None = None,
    ) -> dict[str, Any]:
        """Prepend the rush order and rerun the full scheduling pipeline.

        The rush order is given max urgency_score=10 and due_date=today so
        OrderPrioritizerAgent scores it first in the queue.
        """
        from agents.scheduler_agent.production_scheduler import create_production_schedule
        from services.bom_service import load_bom

        rush = scenario.get("order") or {}
        if not rush:
            return {"status": "error", "errors": ["scenario.order is required for rush_order"]}
        if not orders:
            return {"status": "error", "errors": ["orders must be included in the what-if request for rush_order"]}

        rush_id = rush.get("order_id") or rush.get("order") or f"RUSH-{id(rush)}"
        rush_order: dict[str, Any] = {
            "order_id":         rush_id,
            "product_name":     rush.get("product_name", "Rush Order"),
            "urgency_score":    10,
            "due_date":         rush.get("due_date") or date.today().isoformat(),
            "duration_minutes": rush.get("duration_minutes", 60),
            "machine_type":     rush.get("machine_type"),
            "quantity":         rush.get("quantity", 1),
        }

        augmented_orders = [rush_order] + list(orders)
        effective_bom = bom if bom is not None else load_bom()

        new_schedule = create_production_schedule(
            orders=augmented_orders,
            machines_data=machines,
            inventory_data=inventory,
            bom=effective_bom,
        )

        original_items = {s.get("order"): s for s in schedule}
        affected: list[dict[str, Any]] = []
        schedule_changes: list[dict[str, Any]] = []

        for item in new_schedule:
            oid = item.get("order")
            if oid == rush_id:
                continue
            new_status = item.get("status", "scheduled")
            old_status = original_items.get(oid, {}).get("status", "scheduled")
            if new_status in ("blocked", "delayed") and old_status not in ("blocked", "delayed"):
                affected.append({
                    "order":  oid,
                    "was":    old_status,
                    "now":    new_status,
                    "reason": "displaced_by_rush_order",
                })
                schedule_changes.append({"order": oid, "reason": "conflict_with_rush"})

        delayed_orders = [a["order"] for a in affected]

        return {
            "status": "success",
            "scenario": {"type": "rush_order", "order_id": rush_id},
            "impact": {
                "delayed_orders": delayed_orders,
                "schedule_changes": schedule_changes,
                "utilization_changes": cls._util_changes(schedule, new_schedule),
                "new_schedule": new_schedule,
                "affected_orders": affected,
            },
            "errors": [],
        }
