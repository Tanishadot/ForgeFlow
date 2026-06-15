"""
Auth helper routes.
  GET  /api/v1/auth/employee-email?employee_id=EMP-001
    → Returns the Supabase auth email for a given employee ID.
  POST /api/v1/auth/complete-signup
    → Creates company / profile / employee records using the service role key.
    → Called immediately after supabase.auth.signUp() so the frontend never
      needs an active session to insert these rows (bypasses RLS entirely).
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class EmployeeEmailResponse(BaseModel):
    email: str | None
    found: bool


@router.get("/employee-email", response_model=EmployeeEmailResponse)
async def get_employee_email(
    employee_id: str = Query(..., description="The employee's ID (e.g. EMP-001)"),
):
    """
    Look up the email address registered for a given employee_id.
    This endpoint is intentionally unauthenticated so the login page
    can resolve an employee_id to an email without the user being signed in.

    Security: only the email is returned — no sensitive personal data.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured on the server.",
        )

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/employees"
    headers = {
        "apikey":        settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            headers=headers,
            params={
                "select":      "email",
                "employee_id": f"eq.{employee_id}",
                "limit":       "1",
            },
            timeout=10,
        )

    if resp.status_code != 200:
        logger.warning("Supabase lookup failed: %s %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Database lookup failed")

    data = resp.json()
    if not data:
        return EmployeeEmailResponse(email=None, found=False)

    email = data[0].get("email")
    return EmployeeEmailResponse(email=email, found=bool(email))


# ── Complete Signup ────────────────────────────────────────────────────────────

class CompleteSignupRequest(BaseModel):
    user_id:      str
    admin_name:   str
    email:        str
    company_name: str
    industry:     str | None = None
    location:     str | None = None
    timezone:     str = "UTC"
    factory_size: str = "small"
    num_shifts:   str = "1"


class CompleteSignupResponse(BaseModel):
    company_id: str
    ok:         bool


def _sb_headers() -> dict[str, str]:
    return {
        "apikey":        settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }


def _rest(path: str) -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}"


@router.post("/complete-signup", response_model=CompleteSignupResponse)
async def complete_signup(req: CompleteSignupRequest):
    """
    Creates company, profile, and employee rows using the service-role key.
    This bypasses RLS so it works regardless of whether the Supabase auth
    session is active (i.e. works even when email confirmation is enabled).
    """
    if not settings.supabase_is_configured:
        raise HTTPException(status_code=503, detail="Supabase not configured on server.")

    headers = _sb_headers()

    async with httpx.AsyncClient() as client:
        # 1. Insert company
        company_resp = await client.post(
            _rest("companies"),
            headers=headers,
            json={
                "company_name": req.company_name,
                "industry":     req.industry,
                "location":     req.location,
                "timezone":     req.timezone,
                "factory_size": req.factory_size,
                "num_shifts":   req.num_shifts,
            },
            timeout=10,
        )

        if company_resp.status_code not in (200, 201):
            logger.error("Company insert failed: %s %s", company_resp.status_code, company_resp.text[:300])
            raise HTTPException(status_code=502, detail=f"Failed to create company: {company_resp.text[:200]}")

        company_data = company_resp.json()
        company_id = company_data[0]["id"] if isinstance(company_data, list) else company_data["id"]

        # 2. Upsert profile (admin)
        profile_resp = await client.post(
            _rest("profiles"),
            headers={**headers, "Prefer": "return=minimal,resolution=merge-duplicates"},
            json={
                "id":                      req.user_id,
                "full_name":               req.admin_name,
                "employee_id":             "ADMIN-001",
                "role":                    "admin",
                "company_id":              company_id,
                "password_reset_required": False,
            },
            timeout=10,
        )

        if profile_resp.status_code not in (200, 201, 204):
            logger.warning("Profile upsert warning: %s %s", profile_resp.status_code, profile_resp.text[:200])

        # 3. Insert admin into employees table
        await client.post(
            _rest("employees"),
            headers={**headers, "Prefer": "return=minimal"},
            json={
                "company_id":              company_id,
                "employee_id":             "ADMIN-001",
                "name":                    req.admin_name,
                "email":                   req.email,
                "role":                    "admin",
                "password_reset_required": False,
                "auth_user_id":            req.user_id,
            },
            timeout=10,
        )

    return CompleteSignupResponse(company_id=company_id, ok=True)
