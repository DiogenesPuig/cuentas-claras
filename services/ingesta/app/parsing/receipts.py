"""Lógica pura de extracción de comprobantes (FR-14).

SIN imports de FastAPI/red: recibe el texto ya extraído (OCR) y devuelve el
modelo del contrato. El OCR en sí (Tesseract sobre la imagen/PDF) es el borde
con IO y vive en el route; la heurística de extracción —lo caro de reescribir—
vive acá y se testea con texto fijo. F2-2 implementa las heurísticas reales.
"""

from __future__ import annotations

from app.schemas import ReceiptExtraction


def extract_from_text(text: str) -> ReceiptExtraction:
    """Stub de F2-1: devuelve la forma del contrato con confianza 0.

    F2-2 reemplaza esto por las heurísticas reales (regex de monto/fecha,
    detección de comercio y de subtipo comprobante-de-transferencia).
    """
    return ReceiptExtraction(confidence=0.0)
