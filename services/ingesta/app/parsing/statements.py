"""Dispatcher de parseo de resúmenes (FR-16) — lógica PURA sobre texto.

Recibe el texto ya extraído del PDF (la extracción vive en `app/pdf.py`, el borde
de IO) y elige el parser por plantilla. Hoy: Patagonia tabular (Visa/Master/CR) y
Nativa-Nación (Mastercard, Banco Nación).
"""

from __future__ import annotations

from app.parsing import nativa_nacion, patagonia
from app.schemas import StatementParse


class UnsupportedStatementError(Exception):
    """El layout del resumen no coincide con ningún parser conocido."""


def parse_statement_text(text: str) -> StatementParse:
    if patagonia.matches(text):
        return patagonia.parse(text)
    if nativa_nacion.matches(text):
        return nativa_nacion.parse(text)
    raise UnsupportedStatementError(
        "No reconocemos el formato de este resumen "
        "(por ahora: Banco Patagonia Visa/Master y Nativa-Nación Mastercard)."
    )
