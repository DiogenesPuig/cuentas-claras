"""Configuración del microservicio, leída del entorno.

El micro es *stateless* y NO toca la base: solo necesita saber cómo validar el
JWT de Supabase, qué origen web habilitar en CORS y los límites de procesado.
NUNCA debe tener la `service_role` key ni credenciales de Postgres.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    # --- Auth (validación del JWT de Supabase) ---
    # Proyecto Supabase, ej. https://abcd.supabase.co. Se usa para derivar el
    # endpoint JWKS (claves asimétricas RS256/ES256) cuando NO hay secret HS256.
    supabase_url: str | None = None
    # Secret legacy HS256 del proyecto (Settings → API → JWT secret). Si está
    # seteado, se valida con HS256; si no, se cae a JWKS contra supabase_url.
    supabase_jwt_secret: str | None = None
    # `aud` esperado en el token de un usuario logueado de Supabase.
    jwt_audience: str = "authenticated"

    # --- CORS ---
    # Origen(es) de la web habilitados, separados por coma.
    web_origin: str = "http://localhost:5173"

    # --- Endurecimiento contra input no confiable ---
    # Tamaño máximo del archivo subido (bytes). Default 10 MB.
    max_upload_bytes: int = 10 * 1024 * 1024
    # Tiempo máximo de procesado de un archivo (segundos) antes de abortar.
    process_timeout_seconds: float = 30.0

    # --- Fallback LLM/visión (Fase B, F2-12) ---
    # Proveedor del fallback de extracción por visión. Hoy soportado: "gemini".
    llm_provider: str = "gemini"
    # API key del proveedor (Gemini: AI Studio, free, sin tarjeta). Si falta, el
    # fallback queda DESACTIVADO y la extracción usa solo la Fase A (no rompe).
    gemini_api_key: str | None = None
    # Modelo de visión de Gemini para la extracción del comprobante.
    gemini_model: str = "gemini-2.0-flash"
    # Si la confianza de la Fase A es <= a esto, se intenta el fallback (con key).
    llm_fallback_max_confidence: float = 0.5

    @property
    def llm_enabled(self) -> bool:
        """True si hay proveedor + key para usar el fallback por visión."""
        return self.llm_provider == "gemini" and bool(self.gemini_api_key)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]

    @property
    def jwks_url(self) -> str | None:
        if not self.supabase_url:
            return None
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
