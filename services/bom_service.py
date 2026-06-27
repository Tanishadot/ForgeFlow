"""
Bill of Materials (BOM) service.

Maps product_name → required materials so the InventoryAgent can block
orders when stock is insufficient. No ERP complexity — just a dict lookup.

Matching strategy (in order):
  1. Exact lowercase match against the BOM key.
  2. Keyword match: if the product name *contains* any BOM key, use that entry.
     This covers product name variations like "Bracket Assembly Rev-2" matching
     the "bracket assembly" entry, or "Hydraulic Cylinder A" matching "hydraulic".
  3. No match → order skipped (no inventory check).

Extend the built-in BOM by creating data/bom.json with the same format.
The file is merged at runtime; no restart needed if you watch for changes.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# quantity_required = total units of material needed per production order
_DEFAULT_BOM: dict[str, list[dict[str, Any]]] = {
    # ── Structural assemblies ───────────────────────────────────
    "bracket assembly":     [{"material": "steel rod 6mm",     "quantity_required": 5.0}],
    "bracket":              [{"material": "steel rod 6mm",     "quantity_required": 3.0}],
    "frame assembly":       [{"material": "steel rod 6mm",     "quantity_required": 8.0},
                             {"material": "steel plate",       "quantity_required": 4.0}],
    "frame":                [{"material": "steel plate",       "quantity_required": 6.0}],
    "chassis":              [{"material": "steel plate",       "quantity_required": 10.0}],
    "weldment":             [{"material": "steel rod 6mm",     "quantity_required": 6.0}],

    # ── Rotating / drive components ─────────────────────────────
    "gear set":             [{"material": "steel billet",      "quantity_required": 3.0}],
    "gear":                 [{"material": "steel billet",      "quantity_required": 2.0}],
    "shaft assembly":       [{"material": "steel rod 25mm",    "quantity_required": 2.0}],
    "shaft":                [{"material": "steel rod 25mm",    "quantity_required": 1.5}],
    "sprocket":             [{"material": "steel billet",      "quantity_required": 1.0}],
    "pulley":               [{"material": "aluminum ingot",    "quantity_required": 1.0}],
    "coupling":             [{"material": "steel billet",      "quantity_required": 1.0}],
    "flywheel":             [{"material": "cast iron",         "quantity_required": 5.0}],
    "spindle":              [{"material": "steel rod 25mm",    "quantity_required": 1.0}],

    # ── Bearings ────────────────────────────────────────────────
    "bearing assembly":     [{"material": "bearing steel",     "quantity_required": 4.0}],
    "bearing":              [{"material": "bearing steel",     "quantity_required": 2.0}],
    "roller bearing":       [{"material": "bearing steel",     "quantity_required": 3.0}],
    "thrust bearing":       [{"material": "bearing steel",     "quantity_required": 2.0}],
    "ball bearing":         [{"material": "bearing steel",     "quantity_required": 2.0}],

    # ── Housings / enclosures ───────────────────────────────────
    "aluminum housing":     [{"material": "aluminum ingot",    "quantity_required": 3.0}],
    "motor housing":        [{"material": "cast iron",         "quantity_required": 4.0},
                             {"material": "steel bolt",        "quantity_required": 8.0}],
    "gearbox housing":      [{"material": "cast iron",         "quantity_required": 5.0}],
    "pump housing":         [{"material": "cast iron",         "quantity_required": 3.0}],
    "valve body":           [{"material": "cast iron",         "quantity_required": 2.0}],
    "manifold":             [{"material": "aluminum ingot",    "quantity_required": 4.0}],
    "enclosure":            [{"material": "steel sheet 2mm",   "quantity_required": 6.0}],
    "casing":               [{"material": "aluminum ingot",    "quantity_required": 3.0}],

    # ── Hydraulic / pneumatic ───────────────────────────────────
    "hydraulic unit":       [{"material": "hydraulic fluid",   "quantity_required": 5.0}],
    "hydraulic":            [{"material": "hydraulic fluid",   "quantity_required": 3.0}],
    "hydraulic cylinder":   [{"material": "steel cylinder",    "quantity_required": 1.0},
                             {"material": "hydraulic seal",    "quantity_required": 4.0}],
    "pneumatic cylinder":   [{"material": "aluminum ingot",    "quantity_required": 1.0},
                             {"material": "o-ring seal",       "quantity_required": 4.0}],
    "cylinder":             [{"material": "steel cylinder",    "quantity_required": 1.0}],
    "valve assembly":       [{"material": "cast iron",         "quantity_required": 1.0},
                             {"material": "rubber seal",       "quantity_required": 3.0}],
    "valve":                [{"material": "cast iron",         "quantity_required": 1.0}],
    "pump assembly":        [{"material": "cast iron",         "quantity_required": 3.0},
                             {"material": "rubber seal",       "quantity_required": 2.0}],
    "pump":                 [{"material": "cast iron",         "quantity_required": 2.0}],

    # ── Electrical / control ────────────────────────────────────
    "control panel":        [{"material": "circuit board",     "quantity_required": 2.0},
                             {"material": "wiring harness",    "quantity_required": 2.0}],
    "control":              [{"material": "circuit board",     "quantity_required": 1.0}],
    "electrical panel":     [{"material": "circuit board",     "quantity_required": 3.0},
                             {"material": "copper wire",       "quantity_required": 5.0}],
    "motor assembly":       [{"material": "copper wire",       "quantity_required": 10.0},
                             {"material": "steel laminate",    "quantity_required": 5.0}],
    "motor":                [{"material": "copper wire",       "quantity_required": 8.0}],
    "sensor assembly":      [{"material": "circuit board",     "quantity_required": 1.0},
                             {"material": "copper wire",       "quantity_required": 1.0}],
    "actuator":             [{"material": "copper wire",       "quantity_required": 2.0},
                             {"material": "steel rod 6mm",     "quantity_required": 1.0}],

    # ── Conveyor / material handling ────────────────────────────
    "conveyor belt":        [{"material": "rubber compound",   "quantity_required": 8.0}],
    "conveyor":             [{"material": "rubber compound",   "quantity_required": 6.0},
                             {"material": "steel roller",      "quantity_required": 8.0}],
    "roller assembly":      [{"material": "steel roller",      "quantity_required": 6.0},
                             {"material": "bearing steel",     "quantity_required": 2.0}],

    # ── Fasteners / hardware ────────────────────────────────────
    "fastener kit":         [{"material": "steel bolt",        "quantity_required": 20.0}],
    "bolt assembly":        [{"material": "steel bolt",        "quantity_required": 12.0}],

    # ── Generic / demo product names ────────────────────────────
    "widget a":             [{"material": "steel rod 6mm",     "quantity_required": 2.0}],
    "widget b":             [{"material": "aluminum sheet",    "quantity_required": 1.0}],
    "widget c":             [{"material": "steel billet",      "quantity_required": 1.0}],
    "product alpha":        [{"material": "steel billet",      "quantity_required": 2.0}],
    "product beta":         [{"material": "aluminum ingot",    "quantity_required": 2.0}],
    "product gamma":        [{"material": "cast iron",         "quantity_required": 3.0}],
    "part a":               [{"material": "steel rod 6mm",     "quantity_required": 1.0}],
    "part b":               [{"material": "aluminum sheet",    "quantity_required": 1.0}],
    "part x":               [{"material": "steel rod 6mm",     "quantity_required": 1.0}],
    "part y":               [{"material": "aluminum sheet",    "quantity_required": 1.0}],
    "part z":               [{"material": "steel billet",      "quantity_required": 1.0}],
    "component a":          [{"material": "steel rod 6mm",     "quantity_required": 2.0}],
    "component b":          [{"material": "aluminum ingot",    "quantity_required": 2.0}],
    "assembly a":           [{"material": "steel plate",       "quantity_required": 3.0}],
    "assembly b":           [{"material": "cast iron",         "quantity_required": 2.0}],
}

_BOM_FILE = Path("data/bom.json")

_ORDER_ID_KEYS = ("order_id", "order", "id")
_PRODUCT_KEYS  = ("product_name", "material", "material_name", "sku", "product_id")

# Module-level cache — built once on first call, reused for the process lifetime.
# To pick up edits to data/bom.json without a full restart, call _invalidate_bom_cache().
_bom_cache: dict[str, list[dict[str, Any]]] | None = None


def _invalidate_bom_cache() -> None:
    global _bom_cache
    _bom_cache = None


def load_bom() -> dict[str, list[dict[str, Any]]]:
    """Return the active BOM, merging data/bom.json if it exists.

    Result is cached for the process lifetime. Changes to data/bom.json
    require a server restart (or call _invalidate_bom_cache() in tests).
    """
    global _bom_cache
    if _bom_cache is not None:
        return _bom_cache

    bom: dict[str, list[dict[str, Any]]] = {k: list(v) for k, v in _DEFAULT_BOM.items()}
    if _BOM_FILE.exists():
        try:
            with _BOM_FILE.open() as fh:
                custom = json.load(fh)
            if isinstance(custom, dict):
                for key, lines in custom.items():
                    if key.startswith("_"):
                        continue  # skip meta keys like _readme, _example
                    bom[key.strip().lower()] = lines
                logger.info("Merged %d custom BOM entries from %s", len(custom), _BOM_FILE)
        except Exception:
            logger.exception("Failed to load %s — using built-in defaults", _BOM_FILE)

    _bom_cache = bom
    return _bom_cache


def _lookup(product_key: str, bom: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]] | None:
    """Resolve a product name to BOM lines using exact then keyword matching."""
    # 1. Exact match
    if product_key in bom:
        return bom[product_key]
    # 2. Keyword match: product name contains a BOM key
    #    Sort by key length descending so "bracket assembly" wins over "bracket"
    for key in sorted(bom, key=len, reverse=True):
        if key in product_key:
            logger.debug("BOM keyword match: '%s' matched via '%s'", product_key, key)
            return bom[key]
    return None


def resolve_order_requirements(
    orders: list[dict[str, Any]],
    bom: dict[str, list[dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    """Expand a list of orders into material requirements using the BOM.

    Returns [{order, material, required_quantity}] compatible with
    inventory_checker._status_for_requirement().

    Orders whose product name has no BOM entry (exact or keyword) are silently
    skipped — they will not be inventory-blocked.
    """
    if bom is None:
        bom = load_bom()

    requirements: list[dict[str, Any]] = []

    for idx, order in enumerate(orders):
        order_id = _first_val(order, _ORDER_ID_KEYS) or f"row-{idx}"
        product_raw = _first_val(order, _PRODUCT_KEYS)
        if not product_raw:
            continue
        product_key = str(product_raw).strip().lower()
        lines = _lookup(product_key, bom)
        if not lines:
            logger.debug("No BOM entry for '%s' (order %s) — no inventory check", product_key, order_id)
            continue
        for line in lines:
            mat = line.get("material", "")
            qty = float(line.get("quantity_required", 0.0))
            if not mat or qty <= 0:
                continue
            requirements.append({
                "order":             str(order_id),
                "material":          str(mat),
                "required_quantity": qty,
            })

    return requirements


def _first_val(row: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for k in keys:
        v = row.get(k)
        if v is not None and str(v).strip().lower() not in ("", "nan", "none", "null"):
            return v
    return None
