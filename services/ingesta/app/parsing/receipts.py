"""Lógica pura de extracción de comprobantes (FR-14).

SIN imports de FastAPI/red: recibe el texto ya extraído (por OCR o por la capa de
texto del PDF) y devuelve el modelo del contrato. El OCR en sí (Tesseract sobre
la imagen) es el borde con IO y vive en `app/ocr.py`; la heurística de
extracción —lo caro de reescribir— vive acá y se testea con texto fijo.

Maneja dos subtipos vistos en las muestras:
- **Ticket de compra** de comercio (monto cerca de "TOTAL", comercio en el encabezado).
- **Comprobante de transferencia** (clave-valor: Importe, Fecha, Destino, CBU…).
"""

from __future__ import annotations

import re
from datetime import date

from app.schemas import ReceiptExtraction

# --- Subtipo ---------------------------------------------------------------

_TRANSFER_HINTS = (
    "transferencia",
    "cbu",
    "cvu",
    "alias",
    "cuenta destino",
    "comprobante de",
    "nº de operac",
    "n° de operac",
    "numero de operac",
    "número de operac",
)


def detect_subtype(text: str) -> str:
    """'transfer' si parece comprobante de transferencia; si no, 'purchase'."""
    low = text.lower()
    hits = sum(1 for kw in _TRANSFER_HINTS if kw in low)
    return "transfer" if hits >= 2 else "purchase"


# --- Monto -----------------------------------------------------------------

# Tokens de monto: formato AR (1.234,56), o simple (1234,56 / 1234.56 / 1234).
_AMOUNT_RE = re.compile(r"\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+")


def parse_amount(token: str) -> float | None:
    """Normaliza un token numérico AR/US a float. Devuelve None si no es válido."""
    token = token.strip()
    if not token:
        return None
    has_dot = "." in token
    has_comma = "," in token
    try:
        if has_dot and has_comma:
            # 1.234,56 → punto miles, coma decimal.
            normalized = token.replace(".", "").replace(",", ".")
        elif has_comma:
            # 1234,56 → coma decimal.
            normalized = token.replace(",", ".")
        else:
            # 1234.56 (decimal) o 1234 (entero). El punto se interpreta decimal.
            normalized = token
        value = float(normalized)
    except ValueError:
        return None
    return value if value > 0 else None


_TOTAL_LINE = re.compile(r"\btotal(?:\s+a\s+pagar)?\b", re.IGNORECASE)
_SUBTOTAL_LINE = re.compile(r"\bsubtotal\b", re.IGNORECASE)
_IMPORTE_LINE = re.compile(r"\bimporte\b", re.IGNORECASE)


def _amounts_in(line: str) -> list[float]:
    out = []
    for m in _AMOUNT_RE.findall(line):
        v = parse_amount(m)
        if v is not None:
            out.append(v)
    return out


def extract_amount(text: str, subtype: str) -> float | None:
    """Elige el monto más probable.

    - Transferencia: el que está en la línea de "Importe".
    - Compra: el de la línea de "TOTAL" (no "SUBTOTAL"); si no hay, el mayor.
    """
    lines = text.splitlines()
    keyword = _IMPORTE_LINE if subtype == "transfer" else _TOTAL_LINE

    keyed: list[float] = []
    everything: list[float] = []
    for line in lines:
        amounts = _amounts_in(line)
        everything.extend(amounts)
        if keyword.search(line) and not _SUBTOTAL_LINE.search(line):
            keyed.extend(amounts)

    if keyed:
        return max(keyed)
    if everything:
        return max(everything)
    return None


# --- Moneda ----------------------------------------------------------------


def extract_currency(text: str) -> str | None:
    low = text.lower()
    if re.search(r"u\$s|us\$|usd|d[oó]lar", low):
        return "USD"
    if "$" in text or "ars" in low or "peso" in low:
        return "ARS"
    return None


# --- Fecha -----------------------------------------------------------------

_DATE_DMY = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b")
_DATE_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")


def extract_date(text: str) -> str | None:
    """Primera fecha válida del texto, en ISO YYYY-MM-DD."""
    for m in _DATE_ISO.finditer(text):
        iso = _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if iso:
            return iso
    for m in _DATE_DMY.finditer(text):
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 2000
        iso = _safe_date(year, month, day)
        if iso:
            return iso
    return None


def _safe_date(year: int, month: int, day: int) -> str | None:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


# --- Comercio / contraparte ------------------------------------------------

_NON_MERCHANT = re.compile(
    r"factura|ticket|comprobante|cuit|c\.?u\.?i\.?t|^\W*$|^\d|total|importe|fecha|hora",
    re.IGNORECASE,
)
_DESTINO_RE = re.compile(r"(?:destino|para|titular|beneficiari[oa])\s*:?\s*(.+)", re.IGNORECASE)


def extract_merchant(text: str, subtype: str) -> str | None:
    """Comercio (compra) o contraparte (transferencia)."""
    if subtype == "transfer":
        for line in text.splitlines():
            m = _DESTINO_RE.search(line)
            if m:
                name = m.group(1).strip()
                if name and not name.isdigit():
                    return name
        return None

    # Compra: primera línea "con sentido" del encabezado.
    for line in text.splitlines()[:6]:
        candidate = line.strip()
        if len(candidate) < 3:
            continue
        if _NON_MERCHANT.search(candidate):
            continue
        if not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", candidate):
            continue
        return candidate
    return None


# --- Orquestación ----------------------------------------------------------


def extract_from_text(text: str) -> ReceiptExtraction:
    """Extrae monto/moneda/fecha/comercio del texto y estima la confianza."""
    if not text or not text.strip():
        return ReceiptExtraction(confidence=0.0)

    subtype = detect_subtype(text)
    amount = extract_amount(text, subtype)
    currency = extract_currency(text) if amount is not None else None
    occurred = extract_date(text)
    merchant = extract_merchant(text, subtype)

    confidence = 0.0
    if amount is not None:
        confidence += 0.5
    if occurred is not None:
        confidence += 0.3
    if merchant:
        confidence += 0.2

    return ReceiptExtraction(
        amount=amount,
        currency=currency,
        date=occurred,
        merchant=merchant,
        confidence=round(confidence, 2),
    )
