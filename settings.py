"""Centralised application settings loaded from environment / .env file."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── NVIDIA NIM ──────────────────────────────────────────────────────────
    nvidia_api_key: str = ""
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_nim_model: str = "meta/llama-3.1-8b-instruct"
    nvidia_nim_timeout_seconds: float = 30.0
    nvidia_nim_max_tokens_chat: int = 800
    nvidia_nim_max_tokens_explain: int = 1200
    nvidia_nim_temperature: float = 0.2

    # ── Supabase ─────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # JWT secret for local token verification (Project Settings → API → JWT Secret)
    supabase_jwt_secret: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins, e.g.:
    #   ALLOWED_ORIGINS=https://app.forgeflow.ai,https://staging.forgeflow.ai
    allowed_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:4173"

    @property
    def nim_is_configured(self) -> bool:
        return bool(self.nvidia_api_key)

    @property
    def supabase_is_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def nim_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.nvidia_api_key}",
            "Content-Type": "application/json",
        }

    @property
    def nim_chat_url(self) -> str:
        return self.nvidia_nim_base_url.rstrip("/") + "/chat/completions"


# Single shared instance — import this everywhere.
settings = Settings()
