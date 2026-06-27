"""
Main entry point for ForgeFlow AI.
FastAPI application for production planning with NVIDIA NIM integration.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from limiter import limiter
from settings import settings
from routes.data_routes import router as data_router
from routes.explanation_routes import router as explanation_router
from routes.copilot_routes import router as copilot_router
from routes.schedule_routes import router as schedule_router
from routes.onboarding_routes import router as onboarding_router
from routes.auth_routes import router as auth_router
from routes.shift_routes import router as shift_router

# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="ForgeFlow AI",
    description="AI-powered production planning for manufacturing. Powered by NVIDIA NIM.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — explicit origins only ──────────────────────────────────────────────
_allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(data_router)
app.include_router(explanation_router)
app.include_router(copilot_router)
app.include_router(schedule_router)
app.include_router(onboarding_router)
app.include_router(auth_router)
app.include_router(shift_router)


# ── Startup checks ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_checks() -> None:
    """Verify optional Supabase tables exist and log actionable warnings."""
    import httpx
    log = logging.getLogger("forgeflow.startup")

    if not settings.supabase_is_configured:
        log.warning("Supabase not configured — schedule persistence disabled.")
        return

    if not settings.supabase_jwt_secret:
        log.warning(
            "SUPABASE_JWT_SECRET not set. Route auth will fall back to a "
            "Supabase network call per request. Add the JWT secret from "
            "Project Settings → API → JWT Secret for faster verification."
        )

    try:
        headers = {
            "apikey":        settings.supabase_service_role_key or "",
            "Authorization": f"Bearer {settings.supabase_service_role_key or ''}",
        }
        url = f"{settings.supabase_url}/rest/v1/schedules?select=id&limit=1"
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url, headers=headers)
        if r.status_code == 404 or (r.status_code == 400 and "relation" in r.text.lower()):
            log.warning(
                "⚠  'schedules' table not found in Supabase. "
                "Run supabase/migrations/001_schedules.sql in the SQL Editor to enable "
                "schedule persistence."
            )
        else:
            log.info("✓ Supabase 'schedules' table reachable.")
    except Exception:
        log.debug("Could not verify 'schedules' table at startup (non-fatal).")


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    """Root endpoint providing basic service information."""
    return {
        "service": "ForgeFlow AI",
        "version": "1.0.0",
        "status": "running",
        "nim": {
            "configured": settings.nim_is_configured,
            "model": settings.nvidia_nim_model if settings.nim_is_configured else None,
        },
        "supabase": {
            "configured": settings.supabase_is_configured,
        },
        "endpoints": {
            "docs":              "/docs",
            "health":            "/api/v1/health",
            "schedule":          "/api/v1/schedule",
            "whatif":            "/api/v1/whatif",
            "seed":              "/api/v1/seed",
            "copilot":           "/copilot/chat",
            "explain":           "/explain",
            "onboarding":        "/api/v1/onboarding/{employees|machines|inventory}",
            "auth_lookup":       "/api/v1/auth/employee-email",
            "shift_summarize":   "/api/v1/shift/summarize",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
