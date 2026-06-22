"""Borde de IO para resúmenes PDF: bytes → texto plano (capa de texto).

Aislado de la lógica pura de parseo (`app/parsing/`). Importa `pdfplumber` de
forma LAZY (extra `[ocr]`). El PDF puede venir protegido con contraseña: se pasa
a `pdfplumber` y se usa SOLO en memoria — nunca se persiste ni se loguea.
"""

from __future__ import annotations

import io


class PdfPasswordError(Exception):
    """El PDF está protegido y la contraseña falta o es incorrecta."""


class PdfReadError(Exception):
    """El PDF no se pudo abrir/leer (corrupto o no es un PDF)."""


def pdf_to_text(content: bytes, password: str | None = None) -> str:
    """Extrae la capa de texto de todas las páginas. La password se usa en memoria."""
    import pdfplumber
    from pdfminer.pdfdocument import PDFPasswordIncorrect

    try:
        with pdfplumber.open(io.BytesIO(content), password=password or "") as pdf:
            parts = [page.extract_text() or "" for page in pdf.pages]
    except PDFPasswordIncorrect as exc:
        raise PdfPasswordError("La contraseña del PDF es incorrecta o falta.") from exc
    except Exception as exc:  # noqa: BLE001 — cualquier otro fallo de lectura
        # pdfminer a veces señala password requerida con otros errores genéricos.
        if "password" in str(exc).lower() or "encrypt" in str(exc).lower():
            raise PdfPasswordError("El PDF está protegido: hace falta la contraseña.") from exc
        raise PdfReadError(f"No se pudo leer el PDF: {exc}") from exc

    return "\n".join(parts).strip()
