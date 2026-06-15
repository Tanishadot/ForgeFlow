"""
Onboarding routes: CSV / XLSX upload for employees, machines, inventory, and orders.
Each endpoint accepts multipart/form-data with:
  - file:       the CSV or XLSX file
  - company_id: the target company UUID
"""

from __future__ import annotations

import io
import logging
from typing import Any

import httpx
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


# ── Supabase helpers ─────────────────────────────────────────────────────────

def _sb_headers() -> dict[str, str]:
    key = settings.supabase_service_role_key
    if not key:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
        )
    return {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }


def _sb_rest_url(table: str) -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1/{table}"


def _sb_auth_admin_url() -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"


async def _upsert_rows(
    client: httpx.AsyncClient,
    table: str,
    rows: list[dict[str, Any]],
    on_conflict: str,
) -> tuple[int, list[str]]:
    if not rows:
        return 0, []

    resp = await client.post(
        _sb_rest_url(table),
        headers={**_sb_headers(), "Prefer": "return=representation,resolution=merge-duplicates"},
        params={"on_conflict": on_conflict},
        json=rows,
        timeout=30,
    )

    if resp.status_code not in (200, 201):
        return 0, [f"HTTP {resp.status_code}: {resp.text[:300]}"]

    try:
        return len(resp.json()), []
    except Exception:
        return len(rows), []


async def _create_auth_user(
    client: httpx.AsyncClient,
    email: str,
    password: str = "employee123",
    full_name: str = "",
) -> str | None:
    resp = await client.post(
        _sb_auth_admin_url(),
        headers=_sb_headers(),
        json={
            "email":         email,
            "password":      password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return resp.json().get("id")
    logger.warning("Failed to create auth user for %s: %s", email, resp.text[:200])
    return None


# ── File parser ──────────────────────────────────────────────────────────────

def _parse_file(content: bytes, filename: str) -> list[dict[str, str]]:
    """Parse CSV or XLSX into a list of row dicts with stripped string values."""
    fname = (filename or "").lower()

    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content), dtype=str)
    else:
        df = pd.read_csv(io.StringIO(content.decode("utf-8-sig")), dtype=str)

    df.columns = df.columns.str.strip()
    df = df.where(pd.notna(df), "")
    df = df.applymap(lambda v: v.strip() if isinstance(v, str) else v)  # type: ignore[attr-defined]
    return df.to_dict("records")


def _str(row: dict, *keys: str, default: str = "") -> str:
    """Return first non-empty value for the given column name aliases."""
    for k in keys:
        v = row.get(k, "").strip()
        if v:
            return v
    return default


def _float(val: str, default: float = 0.0) -> float:
    try:
        return float(val) if val else default
    except ValueError:
        return default


def _int(val: str, default: int = 0) -> int:
    try:
        return int(float(val)) if val else default
    except ValueError:
        return default


# ── Response model ───────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    status:   str
    inserted: int
    errors:   list[str]


# ── Employees ────────────────────────────────────────────────────────────────

@router.post("/employees", response_model=UploadResponse)
async def upload_employees(
    file:       UploadFile = File(...),
    company_id: str        = Form(...),
):
    content = await file.read()
    rows    = _parse_file(content, file.filename or "")

    if not rows:
        raise HTTPException(status_code=400, detail="File is empty or malformed")

    errors:   list[str] = []
    inserted = 0

    async with httpx.AsyncClient() as client:
        for i, row in enumerate(rows):
            employee_id = _str(row, "employee_id", "Employee ID")
            email       = _str(row, "email", "Email")
            name        = _str(row, "name", "Name")
            department  = _str(row, "department", "Department")
            role_val    = _str(row, "role", "Role", default="employee").lower()
            shift       = _str(row, "shift", "Shift")
            skill_level = _str(row, "skill_level", "Skill Level")
            phone       = _str(row, "phone", "Phone")

            if not employee_id or not email:
                errors.append(f"Row {i+2}: employee_id and email are required")
                continue

            if role_val not in ("admin", "manager", "employee"):
                role_val = "employee"

            auth_user_id = await _create_auth_user(client, email, "employee123", name)

            emp_row: dict[str, Any] = {
                "company_id":              company_id,
                "employee_id":             employee_id,
                "name":                    name or None,
                "email":                   email,
                "department":              department or None,
                "role":                    role_val,
                "shift":                   shift or None,
                "skill_level":             skill_level or None,
                "phone":                   phone or None,
                "password_reset_required": True,
                "auth_user_id":            auth_user_id,
            }

            cnt, errs = await _upsert_rows(client, "employees", [emp_row], "company_id,employee_id")
            inserted += cnt
            errors.extend(errs)

            if auth_user_id:
                _, perrs = await _upsert_rows(
                    client, "profiles",
                    [{
                        "id":                      auth_user_id,
                        "full_name":               name or None,
                        "employee_id":             employee_id,
                        "role":                    role_val,
                        "company_id":              company_id,
                        "password_reset_required": True,
                    }],
                    "id",
                )
                errors.extend(perrs)

    return UploadResponse(status="ok", inserted=inserted, errors=errors)


# ── Machines ─────────────────────────────────────────────────────────────────

@router.post("/machines", response_model=UploadResponse)
async def upload_machines(
    file:       UploadFile = File(...),
    company_id: str        = Form(...),
):
    content = await file.read()
    rows    = _parse_file(content, file.filename or "")

    if not rows:
        raise HTTPException(status_code=400, detail="File is empty or malformed")

    machine_rows: list[dict[str, Any]] = []
    errors: list[str] = []

    for i, row in enumerate(rows):
        machine_code = _str(row, "machine_code", "Machine Code", "Machine ID")
        name         = _str(row, "name", "Name")
        m_type       = _str(row, "type", "Type")
        department   = _str(row, "department", "Department")
        status       = _str(row, "status", "Status", default="idle").lower()
        capacity     = _str(row, "capacity_per_hour", "Capacity/hr", "Capacity")
        maint        = _str(row, "maintenance_schedule", "Maintenance Schedule")
        cost         = _str(row, "operating_cost_per_hour", "Operating Cost/hr", "Cost/hr")
        operations   = _str(row, "supported_operations", "Supported Operations")

        if not machine_code:
            errors.append(f"Row {i+2}: machine_code is required")
            continue

        if status not in ("running", "idle", "down", "maintenance"):
            status = "idle"

        ops_list = [o.strip() for o in operations.split(";") if o.strip()] if operations else []

        machine_rows.append({
            "company_id":              company_id,
            "machine_code":            machine_code,
            "name":                    name or machine_code,
            "type":                    m_type or None,
            "department":              department or None,
            "status":                  status,
            "capacity_per_hour":       _int(capacity),
            "maintenance_schedule":    maint or None,
            "operating_cost_per_hour": _float(cost),
            "supported_operations":    ops_list,
        })

    if not machine_rows:
        return UploadResponse(status="ok", inserted=0, errors=errors)

    async with httpx.AsyncClient() as client:
        cnt, errs = await _upsert_rows(client, "machines", machine_rows, "company_id,machine_code")
    errors.extend(errs)

    return UploadResponse(status="ok", inserted=cnt, errors=errors)


# ── Inventory ────────────────────────────────────────────────────────────────

@router.post("/inventory", response_model=UploadResponse)
async def upload_inventory(
    file:       UploadFile = File(...),
    company_id: str        = Form(...),
):
    content = await file.read()
    rows    = _parse_file(content, file.filename or "")

    if not rows:
        raise HTTPException(status_code=400, detail="File is empty or malformed")

    inv_rows: list[dict[str, Any]] = []
    errors: list[str] = []

    for i, row in enumerate(rows):
        material_code = _str(row, "material_code", "Material Code", "Material ID")
        material_name = _str(row, "material_name", "Material Name")
        quantity      = _str(row, "quantity",      "Quantity")
        unit          = _str(row, "unit",           "Unit", default="units")
        min_stock     = _str(row, "minimum_stock",  "Minimum Stock", "Min Stock")
        supplier      = _str(row, "supplier",       "Supplier")
        lead_time     = _str(row, "lead_time_days", "Lead Time Days", "Lead Time")
        cost          = _str(row, "cost",           "Cost")
        storage_loc   = _str(row, "storage_location","Storage Location")

        if not material_code:
            errors.append(f"Row {i+2}: material_code is required")
            continue

        inv_rows.append({
            "company_id":       company_id,
            "material_code":    material_code,
            "material_name":    material_name or material_code,
            "quantity":         _float(quantity),
            "unit":             unit or "units",
            "minimum_stock":    _float(min_stock),
            "supplier":         supplier or None,
            "lead_time_days":   _int(lead_time),
            "cost":             _float(cost),
            "storage_location": storage_loc or None,
        })

    if not inv_rows:
        return UploadResponse(status="ok", inserted=0, errors=errors)

    async with httpx.AsyncClient() as client:
        cnt, errs = await _upsert_rows(client, "inventory", inv_rows, "company_id,material_code")
    errors.extend(errs)

    return UploadResponse(status="ok", inserted=cnt, errors=errors)


# ── Orders ───────────────────────────────────────────────────────────────────

VALID_PRIORITIES = {"low", "normal", "high", "urgent"}
VALID_STATUSES   = {"pending", "in_progress", "completed", "blocked"}


@router.post("/orders", response_model=UploadResponse)
async def upload_orders(
    file:       UploadFile = File(...),
    company_id: str        = Form(...),
):
    content = await file.read()
    rows    = _parse_file(content, file.filename or "")

    if not rows:
        raise HTTPException(status_code=400, detail="File is empty or malformed")

    order_rows: list[dict[str, Any]] = []
    errors: list[str] = []

    for i, row in enumerate(rows):
        order_code       = _str(row, "order_code",            "Order Code")
        customer_name    = _str(row, "customer_name",         "Customer Name")
        product_name     = _str(row, "product_name",          "Product Name")
        quantity         = _str(row, "quantity",              "Quantity", default="1")
        priority         = _str(row, "priority",              "Priority", default="normal").lower()
        deadline         = _str(row, "deadline",              "Deadline")
        req_machine_type = _str(row, "required_machine_type", "Required Machine Type")
        est_duration_raw = _str(row, "estimated_duration", "estimated_duration_hours",
                                    "Estimated Duration", "Estimated Duration Hours", default="60")
        # If column is estimated_duration_hours, convert to minutes
        is_hours_col = bool(
            row.get("estimated_duration_hours") or row.get("Estimated Duration Hours")
        )
        est_duration = str(int(_float(est_duration_raw) * 60)) if is_hours_col else est_duration_raw
        status       = _str(row, "status", "Status", default="pending").lower().replace(" ", "_")

        if not order_code:
            errors.append(f"Row {i+2}: order_code is required")
            continue

        if priority not in VALID_PRIORITIES:
            priority = "normal"
        if status not in VALID_STATUSES:
            status = "pending"

        order_row: dict[str, Any] = {
            "company_id":            company_id,
            "order_code":            order_code,
            "customer_name":         customer_name or None,
            "product_name":          product_name or None,
            "quantity":              _int(quantity, default=1),
            "priority":              priority,
            "deadline":              deadline or None,
            "required_machine_type": req_machine_type or None,
            "estimated_duration":    _int(est_duration, default=60),
            "status":                status,
        }

        order_rows.append(order_row)

    if not order_rows:
        return UploadResponse(status="ok", inserted=0, errors=errors)

    async with httpx.AsyncClient() as client:
        cnt, errs = await _upsert_rows(client, "orders", order_rows, "company_id,order_code")
    errors.extend(errs)

    return UploadResponse(status="ok", inserted=cnt, errors=errors)
