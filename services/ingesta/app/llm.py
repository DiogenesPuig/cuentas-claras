"""Borde IO del fallback por visión (Fase B, F2-12): imagen → ReceiptExtraction.

Cascarón fino sobre el proveedor LLM (hoy Google Gemini). Toda la lógica real
—prompt, parseo, validación, merge— vive en `app/parsing/llm_extract.py` (pura,
testeable). Migrar de proveedor = reescribir SOLO este archivo.

Degradación elegante: si no hay key (o el proveedor no está soportado, o la
llamada falla), devuelve None y la extracción se queda con la Fase A. NUNCA
rompe el endpoint por culpa del fallback.

Corre dentro de `run_with_timeout` (en un thread), así que usamos el cliente
HTTP SÍNCRONO de httpx; el import es lazy para no atar el arranque del micro.
"""

from __future__ import annotations

import base64
import logging

from app.config import Settings
from app.parsing.llm_extract import build_prompt, parse_llm_json, to_extraction
from app.schemas import ReceiptExtraction

logger = logging.getLogger(__name__)

_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def is_enabled(settings: Settings) -> bool:
    """¿Hay proveedor + key para usar el fallback?"""
    return settings.llm_enabled


def _mime_for(content_type: str | None) -> str:
    """MIME a declarar a Gemini. PDF y las imágenes comunes; default JPEG."""
    if content_type:
        low = content_type.lower()
        if "pdf" in low:
            return "application/pdf"
        if low.startswith("image/"):
            return low
    return "image/jpeg"


def extract_with_vision(
    content: bytes,
    content_type: str | None,
    settings: Settings,
) -> ReceiptExtraction | None:
    """Pide al modelo de visión la extracción del comprobante. None si no aplica/falla."""
    if not is_enabled(settings):
        return None
    if settings.llm_provider == "gemini":
        return _extract_with_gemini(content, content_type, settings)
    logger.warning("Proveedor LLM no soportado: %s", settings.llm_provider)
    return None


def _extract_with_gemini(
    content: bytes,
    content_type: str | None,
    settings: Settings,
) -> ReceiptExtraction | None:
    try:
        import httpx

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": _mime_for(content_type),
                                "data": base64.b64encode(content).decode("ascii"),
                            }
                        },
                        {"text": build_prompt()},
                    ]
                }
            ],
            "generationConfig": {"response_mime_type": "application/json"},
        }
        url = _GEMINI_ENDPOINT.format(model=settings.gemini_model)
        with httpx.Client(timeout=settings.process_timeout_seconds) as client:
            resp = client.post(
                url,
                params={"key": settings.gemini_api_key},
                json=payload,
            )
        resp.raise_for_status()
        text = _gemini_text(resp.json())
        if not text:
            return None
        data = parse_llm_json(text)
        if not data:
            return None
        return to_extraction(data)
    except Exception as exc:  # noqa: BLE001 — degradación: cualquier fallo → None (usa Fase A)
        logger.warning("Fallback Gemini falló: %s", exc)
        return None


def _gemini_text(body: dict) -> str | None:
    """Saca el texto de la primera candidata de la respuesta de Gemini."""
    candidates = body.get("candidates") or []
    if not candidates:
        return None
    parts = (candidates[0].get("content") or {}).get("parts") or []
    for part in parts:
        if isinstance(part.get("text"), str) and part["text"].strip():
            return part["text"]
    return None
