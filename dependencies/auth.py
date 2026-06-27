"""FastAPI auth dependency.

Verifies a Supabase JWT on every request to a protected route.

Strategy (in order):
  1. If SUPABASE_JWT_SECRET is configured → verify locally with PyJWT (no
     network hop, ~0 ms overhead).
  2. Otherwise → call Supabase /auth/v1/user with the token (adds one round-
     trip but works without the secret configured).

Returns the decoded JWT payload (or user dict) so route handlers can access
the caller's user_id and role if needed.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from settings import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=True)


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Raise HTTP 401 if the bearer token is missing, expired, or invalid."""
    token = credentials.credentials

    # ── Fast path: local JWT verification ────────────────────────────────────
    if settings.supabase_jwt_secret:
        try:
            import jwt  # PyJWT

            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True},
            )
            return payload
        except Exception as exc:
            logger.debug("Local JWT verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    # ── Fallback: validate via Supabase /auth/v1/user ────────────────────────
    if not settings.supabase_url or not settings.supabase_anon_key:
        logger.warning(
            "SUPABASE_JWT_SECRET and Supabase URL/anon-key not configured — "
            "authentication is DISABLED. Set these in .env to protect routes."
        )
        return {"sub": "unauthenticated", "role": "anon"}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
            )
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        logger.warning("Supabase token verification request failed: %s", exc)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
