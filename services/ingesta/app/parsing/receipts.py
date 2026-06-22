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

# Cualquier corrida de dígitos con separadores `.`/`,`. Filtramos después: los
# CBU/CVU/nº de operación (corridas largas sin decimales) NO son montos.
_NUMERIC_TOKEN = re.compile(r"\d[\d.,]*\d|\d")
# ¿Termina en separador + exactamente 2 dígitos? → tiene parte decimal (centavos).
_HAS_CENTS = re.compile(r"[.,]\d{2}$")
# Agrupación de miles válida con punto: 1.234 / 12.345.678 (sin decimales).
_DOT_THOUSANDS = re.compile(r"^\d{1,3}(?:\.\d{3})+$")


def parse_amount(token: str) -> float | None:
    """Normaliza un token a float con convención AR (punto = miles, coma = decimal).

    Casos: 1.234,56→1234.56 · 15.000→15000 · 1234,56→1234.56 · 1234.56→1234.56
    (un punto con 2 decimales se respeta como decimal) · 999→999.
    """
    token = token.strip().strip(".,")
    if not token:
        return None
    has_dot = "." in token
    has_comma = "," in token
    try:
        if has_comma:
            # La coma es el decimal; los puntos son miles.
            normalized = token.replace(".", "").replace(",", ".")
        elif has_dot:
            if _DOT_THOUSANDS.match(token):
                normalized = token.replace(".", "")  # 15.000 → 15000
            else:
                normalized = token  # 1234.56 → decimal tal cual
        else:
            normalized = token
        value = float(normalized)
    except ValueError:
        return None
    return value if value > 0 else None


_TOTAL_LINE = re.compile(r"\btotal(?:\s+a\s+pagar)?\b", re.IGNORECASE)
_SUBTOTAL_LINE = re.compile(r"\bsubtotal\b", re.IGNORECASE)
# Monto de una transferencia: "Importe" o "Monto".
_AMOUNT_LABEL = re.compile(r"\b(importe|monto)\b", re.IGNORECASE)
# Líneas de identificadores (no llevan montos): CBU, CVU, alias, operación, cuenta…
_IDENTIFIER_LINE = re.compile(
    r"\b(cbu|cvu|alias|cu[ií]t|cu[ií]l|dni|n[º°ro]+\s*de\s*operac|operaci[oó]n|"
    r"cuenta|tarjeta|comprobante\s*n)\b",
    re.IGNORECASE,
)


def _money_tokens(line: str) -> list[tuple[float, bool]]:
    """(valor, tiene_centavos) de los tokens de `line` que parecen plata.

    Descarta identificadores: corridas largas de dígitos SIN parte decimal
    (CBU de 22, nº de operación, etc.).
    """
    if _IDENTIFIER_LINE.search(line):
        return []
    out: list[tuple[float, bool]] = []
    for tok in _NUMERIC_TOKEN.findall(line):
        digits = re.sub(r"\D", "", tok)
        has_cents = bool(_HAS_CENTS.search(tok))
        # Sin decimales y con muchos dígitos → es un identificador, no un monto.
        if not has_cents and len(digits) > 6:
            continue
        value = parse_amount(tok)
        if value is not None:
            out.append((value, has_cents))
    return out


def extract_amount(text: str, subtype: str) -> float | None:
    """Elige el monto más probable, priorizando montos con centavos.

    - Transferencia: el de la línea "Importe"/"Monto".
    - Compra: el de la línea "TOTAL" (no "SUBTOTAL").
    - Si no hay match por etiqueta, gana el mayor monto CON centavos; recién al
      final se consideran los enteros sueltos.
    """
    keyword = _AMOUNT_LABEL if subtype == "transfer" else _TOTAL_LINE

    keyed: list[float] = []
    with_cents: list[float] = []
    plain: list[float] = []
    for line in text.splitlines():
        tokens = _money_tokens(line)
        if not tokens:
            continue
        labeled = keyword.search(line) and not _SUBTOTAL_LINE.search(line)
        for value, has_cents in tokens:
            (with_cents if has_cents else plain).append(value)
            if labeled:
                keyed.append(value)

    if keyed:
        return max(keyed)
    if with_cents:
        return max(with_cents)
    if plain:
        return max(plain)
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
