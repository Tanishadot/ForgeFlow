"""What-If simulation service for production schedules.

Provides lightweight heuristics to estimate impacts of scenarios such as
machine failures, inventory reductions, and rush order insertions.
"""

from __future__ import annotations

from datetime import datetime
import logging
from typing import Any

logger = logging.getLogger(__name__)


class WhatIfSimulationService:
    """Simulate what-if scenarios against a schedule.

    The service uses simple, deterministic heuristics so it can run without
    external ML dependencies. It returns an impact summary including delayed
    orders, schedule changes and utilization deltas per machine.
    """

    @classmethod
    def simulate(cls, schedule: list[dict[str, Any]], machines: list[dict[str, Any]] | None, inventory: list[dict[str, Any]] | None, scenario: dict[str, Any]) -> dict[str, Any]:
        stype = scenario.get("type")
        if stype == "machine_failure":
            return cls._simulate_machine_failure(schedule, machines or [], scenario)
        if stype == "inventory_reduction":
            return cls._simulate_inventory_reduction(schedule, inventory or [], scenario)
        if stype == "rush_order":
            return cls._simulate_rush_order(schedule, machines or [], scenario)
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
    def _simulate_machine_failure(cls, schedule: list[dict[str, Any]], machines: list[dict[str, Any]], scenario: dict[str, Any]) -> dict[str, Any]:
        failed = scenario.get("machine")
        if not failed:
            return {"status": "error", "errors": ["scenario.machine is required for machine_failure"]}

        original_util = cls._compute_utilization(schedule)
        delayed: list[str] = []
        schedule_changes: list[dict[str, Any]] = []
        adjusted = [dict(item) for item in schedule]

        # find available machines (ids)
        available_machines = [m.get("machine_id") or m.get("machine") for m in machines if (m.get("machine_id") or m.get("machine")) != failed]

        for idx, item in enumerate(adjusted):
            if item.get("machine") == failed and item.get("status") != "completed":
                order_id = item.get("order") or item.get("order_id") or f"idx-{idx}"
                delayed.append(order_id)
                # attempt naive reassignment: pick first available machine that has no overlap
                reassigned = False
                for cand in available_machines:
                    conflict = False
                    for other in adjusted:
                        if other is item:
                            continue
                        if other.get("machine") != cand:
                            continue
                        # if times overlap
                        s1 = cls._parse_dt(item.get("start"))
                        e1 = cls._parse_dt(item.get("end"))
                        s2 = cls._parse_dt(other.get("start"))
                        e2 = cls._parse_dt(other.get("end"))
                        if s1 and e1 and s2 and e2 and not (e1 <= s2 or e2 <= s1):
                            conflict = True
                            break
                    if not conflict:
                        old_machine = item.get("machine")
                        item["machine"] = cand
                        schedule_changes.append({"order": order_id, "from": old_machine, "to": cand})
                        reassigned = True
                        break
                if not reassigned:
                    # remain unassigned/delayed
                    item["status"] = "delayed"

        new_util = cls._compute_utilization(adjusted)
        utilization_changes: dict[str, dict[str, float]] = {}
        machines_seen = set(list(original_util.keys()) + list(new_util.keys()))
        for m in machines_seen:
            utilization_changes[m] = {"before": original_util.get(m, 0.0), "after": new_util.get(m, 0.0)}

        return {
            "status": "success",
            "scenario": {"type": "machine_failure", "machine": failed},
            "impact": {
                "delayed_orders": delayed,
                "schedule_changes": schedule_changes,
                "utilization_changes": utilization_changes,
            },
            "errors": [],
        }

    @classmethod
    def _simulate_inventory_reduction(cls, schedule: list[dict[str, Any]], inventory: list[dict[str, Any]], scenario: dict[str, Any]) -> dict[str, Any]:
        # scenario: {type: 'inventory_reduction', 'product_id': 'P1', 'reduction': 10}
        pid = scenario.get("product_id")
        reduction = float(scenario.get("reduction", 0))
        if not pid:
            return {"status": "error", "errors": ["scenario.product_id is required for inventory_reduction"]}

        # build inventory map
        inv_map = {str(i.get("product_id") or i.get("id")): float(i.get("quantity_on_hand") or 0) for i in inventory}
        inv_map[pid] = inv_map.get(pid, 0.0) - reduction

        delayed: list[str] = []
        schedule_changes: list[dict[str, Any]] = []

        for item in schedule:
            order_id = item.get("order") or item.get("order_id")
            product = str(item.get("product_id") or item.get("product") or "")
            qty = float(item.get("quantity") or item.get("qty") or 0)
            if product == pid and inv_map.get(pid, 0) < qty:
                delayed.append(order_id or "unknown")
                schedule_changes.append({"order": order_id, "reason": "insufficient_inventory"})

        original_util = cls._compute_utilization(schedule)
        utilization_changes = {m: {"before": original_util.get(m, 0.0), "after": original_util.get(m, 0.0)} for m in original_util}

        return {
            "status": "success",
            "scenario": {"type": "inventory_reduction", "product_id": pid, "reduction": reduction},
            "impact": {"delayed_orders": delayed, "schedule_changes": schedule_changes, "utilization_changes": utilization_changes},
            "errors": [],
        }

    @classmethod
    def _simulate_rush_order(cls, schedule: list[dict[str, Any]], machines: list[dict[str, Any]], scenario: dict[str, Any]) -> dict[str, Any]:
        # scenario: {type: 'rush_order', 'order': {...}}
        rush = scenario.get("order") or {}
        if not rush:
            return {"status": "error", "errors": ["scenario.order is required for rush_order"]}

        adjusted = [dict(item) for item in schedule]
        # naive insertion: place rush at front and push conflicting same-machine jobs later (mark delayed if can't shift)
        rush_order = dict(rush)
        rush_order_id = rush_order.get("order") or rush_order.get("order_id") or "rush-1"
        # insert at beginning
        adjusted.insert(0, rush_order)

        # compute simplistic conflict resolution: if two jobs share machine and times overlap, mark later as delayed
        delayed: list[str] = []
        schedule_changes: list[dict[str, Any]] = []

        for i in range(len(adjusted)):
            a = adjusted[i]
            for j in range(i + 1, len(adjusted)):
                b = adjusted[j]
                if not a.get("machine") or not b.get("machine"):
                    continue
                if a.get("machine") != b.get("machine"):
                    continue
                s1 = cls._parse_dt(a.get("start"))
                e1 = cls._parse_dt(a.get("end"))
                s2 = cls._parse_dt(b.get("start"))
                e2 = cls._parse_dt(b.get("end"))
                if s1 and e1 and s2 and e2 and not (e1 <= s2 or e2 <= s1):
                    # mark the later entry as delayed
                    order_b = b.get("order") or b.get("order_id")
                    delayed.append(order_b or "unknown")
                    b["status"] = "delayed"
                    schedule_changes.append({"order": order_b, "reason": "conflict_with_rush"})

        original_util = cls._compute_utilization(schedule)
        new_util = cls._compute_utilization(adjusted)
        utilization_changes: dict[str, dict[str, float]] = {}
        machines_seen = set(list(original_util.keys()) + list(new_util.keys()))
        for m in machines_seen:
            utilization_changes[m] = {"before": original_util.get(m, 0.0), "after": new_util.get(m, 0.0)}

        return {
            "status": "success",
            "scenario": {"type": "rush_order", "order_id": rush_order_id},
            "impact": {"delayed_orders": delayed, "schedule_changes": schedule_changes, "utilization_changes": utilization_changes},
            "errors": [],
        }
