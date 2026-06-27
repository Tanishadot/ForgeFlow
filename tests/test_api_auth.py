"""Tests for API authentication enforcement.

Protected routes must reject requests with no token (HTTP 403 from HTTPBearer)
and requests with a malformed/invalid token (HTTP 401 from verify_token).
Public routes must remain reachable without a token.
"""
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app, raise_server_exceptions=False)


# ── public routes (no auth required) ─────────────────────────────────────────

def test_health_endpoint_is_public():
    r = client.get("/api/v1/health")
    assert r.status_code == 200


def test_root_endpoint_is_public():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "ForgeFlow AI"


# ── protected routes — no token → 403 ────────────────────────────────────────

def test_schedule_endpoint_requires_auth():
    r = client.post("/api/v1/schedule", json={"orders": [], "machines": [], "inventory": []})
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


def test_whatif_endpoint_requires_auth():
    r = client.post(
        "/api/v1/whatif",
        json={"schedule": [], "scenario": {"type": "machine_failure", "machine": "M1"}},
    )
    assert r.status_code == 403


def test_explain_endpoint_requires_auth():
    r = client.post("/explain", json={"schedule": [], "context": {}})
    assert r.status_code == 403


def test_copilot_chat_requires_auth():
    r = client.post("/copilot/chat", json={"message": "hello", "session_id": "test"})
    assert r.status_code == 403


def test_seed_endpoint_requires_auth():
    r = client.post("/api/v1/seed")
    assert r.status_code == 403


# ── protected routes — malformed token → 401 ─────────────────────────────────

def test_schedule_with_invalid_token_returns_401():
    r = client.post(
        "/api/v1/schedule",
        json={"orders": [], "machines": [], "inventory": []},
        headers={"Authorization": "Bearer this.is.not.a.real.jwt"},
    )
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


def test_explain_with_invalid_token_returns_401():
    r = client.post(
        "/explain",
        json={"schedule": [], "context": {}},
        headers={"Authorization": "Bearer garbage_token"},
    )
    assert r.status_code == 401


# ── data upload routes (unprotected by design) ────────────────────────────────

def test_data_orders_endpoint_is_accessible():
    """GET /api/v1/data/orders is in data_routes (unprotected) and should not 403."""
    r = client.get("/api/v1/data/orders")
    assert r.status_code == 200
