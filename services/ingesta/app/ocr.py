"""Borde de IO del OCR: bytes (imagen/PDF) → texto plano.

Aislado de la lógica pura (`app/parsing/receipts.py`) y del contrato. Importa
Tesseract/Pillow/pdfplumber de forma LAZY (solo al usarse) para que el micro
arranque aunque el extra `[ocr]` no esté instalado (CI, dev liviano): en ese caso
—o ante cualquier error de OCR— devuelve "" y la extracción cae a confianza 0,
que la web maneja como "no se pudo extraer, cargá manual" (FR-14).

NO se testea con pytest (necesita el binario de Tesseract); lo testeado es la
heurística pura sobre texto.
"""

from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)


def image_or_pdf_to_text(content: bytes, content_type: str | None) -> str:
    """Extrae texto de un comprobante. Devuelve "" si no se puede (no rompe)."""
    try:
        if content_type and "pdf" in content_type.lower():
            return _pdf_to_text(content)
        return _image_to_text(content)
    except Exception as exc:  # noqa: BLE001 — degradación elegante: cualquier fallo → ""
        logger.warning("OCR falló (%s): %s", content_type, exc)
        return ""


def _image_to_text(content: bytes) -> str:
    import pytesseract
    from PIL import Image

    with Image.open(io.BytesIO(content)) as img:
        return pytesseract.image_to_string(img, lang="spa+eng")


def _pdf_to_text(content: bytes) -> str:
    """Capa de texto del PDF (comprobantes/PDF nativos). Sin render→OCR.

    Si el PDF es un escaneo sin capa de texto, devuelve "" (confianza 0).
    """
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts).strip()
