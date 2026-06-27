"""Tests for the BOM service: lookup strategy and module-level cache."""
import pytest
from services.bom_service import load_bom, _lookup, _invalidate_bom_cache


_SAMPLE_BOM = {
    "bracket assembly": [{"material": "steel rod 6mm", "quantity_required": 8.0}],
    "bracket":          [{"material": "steel rod 6mm", "quantity_required": 3.0}],
    "gear set":         [{"material": "steel billet",  "quantity_required": 3.0}],
}


# ── Exact match ───────────────────────────────────────────────────────────────

def test_exact_match_returns_entry():
    result = _lookup("bracket", _SAMPLE_BOM)
    assert result is not None
    assert result[0]["material"] == "steel rod 6mm"
    assert result[0]["quantity_required"] == 3.0


def test_exact_match_is_case_sensitive_to_lowercase_keys():
    # All BOM keys are stored lowercase; lookup key must also be lowercase
    result = _lookup("gear set", _SAMPLE_BOM)
    assert result is not None
    assert result[0]["material"] == "steel billet"


# ── Keyword (containment) match ───────────────────────────────────────────────

def test_keyword_match_product_contains_bom_key():
    result = _lookup("heavy-duty bracket rev-2", _SAMPLE_BOM)
    assert result is not None, "Expected keyword match on 'bracket'"


def test_longest_key_wins_over_shorter_key():
    """'precision bracket assembly' should match 'bracket assembly', not 'bracket'."""
    result = _lookup("precision bracket assembly", _SAMPLE_BOM)
    assert result is not None
    # 'bracket assembly' entry has quantity_required=8.0; 'bracket' has 3.0
    assert result[0]["quantity_required"] == 8.0, (
        "Longer key 'bracket assembly' should win over shorter 'bracket'"
    )


def test_no_match_returns_none():
    result = _lookup("xyzzy_totally_unknown_part_999", _SAMPLE_BOM)
    assert result is None


def test_empty_bom_returns_none():
    result = _lookup("bracket", {})
    assert result is None


# ── Default BOM coverage ───────────────────────────────────────────────────────

def test_default_bom_has_minimum_entries():
    _invalidate_bom_cache()
    bom = load_bom()
    assert len(bom) >= 20, f"Expected at least 20 BOM entries, got {len(bom)}"


def test_default_bom_contains_core_products():
    _invalidate_bom_cache()
    bom = load_bom()
    for key in ("bracket", "gear set", "bearing", "motor", "conveyor"):
        assert any(key in k for k in bom), f"No BOM entry matching '{key}'"


# ── Module-level cache ────────────────────────────────────────────────────────

def test_cache_returns_same_object_on_repeated_calls():
    _invalidate_bom_cache()
    b1 = load_bom()
    b2 = load_bom()
    assert b1 is b2, "load_bom() must return the same cached object"


def test_invalidate_causes_fresh_load():
    _invalidate_bom_cache()
    b1 = load_bom()
    _invalidate_bom_cache()
    b2 = load_bom()
    assert b1 is not b2, "After invalidation a new dict must be returned"


def test_cache_is_not_none_after_load():
    _invalidate_bom_cache()
    bom = load_bom()
    assert bom is not None
    assert isinstance(bom, dict)
