"""Lógica pura de parseo de resúmenes de tarjeta (FR-16).

SIN imports de FastAPI/red/IO: recibe bytes (y password opcional) y devuelve el
modelo del contrato. Así es 100% testeable con fixtures y portable el día que se
cambie de runtime. F2-3 implementa los parsers reales (Nación/Patagonia) sobre
`pdfplumber`; acá solo el esqueleto.
"""

from __future__ import annotations

from app.schemas import StatementParse


def parse_statement(content: bytes, password: str | None = None) -> StatementParse:
    """Stub de F2-1: devuelve la forma del contrato vacía.

    F2-3 reemplaza esto por el parseo real (capa de texto del PDF con
    `pdfplumber`, descifrado en memoria con `password` si viene protegido,
    extracción de filas y `account_hint`). La password NUNCA se persiste.
    """
    return StatementParse()
