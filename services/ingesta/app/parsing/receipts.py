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
import unicodedata
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
# Monto de una transferencia: "Importe"/"Monto" (Patagonia, BNA, Ualá) y los verbos
# de las billeteras (Naranja X: "Enviaste"; otros: "Recibiste"/"Transferiste").
_AMOUNT_LABEL = re.compile(r"\b(importe|monto|enviaste|recibiste|transferiste)\b", re.IGNORECASE)
# Líneas de identificadores (no llevan montos): CBU, CVU, alias, operación, cuenta…
_IDENTIFIER_LINE = re.compile(
    r"\b(cbu|cvu|alias|cu[ií]t|cu[ií]l|dni|n[º°ro]+\s*de\s*operac|operaci[oó]n|"
    r"cuenta|tarjeta|comprobante\s*n)\b",
    re.IGNORECASE,
)


def _date_spans(line: str) -> list[tuple[int, int]]:
    """Rangos de caracteres ocupados por fechas (DMY/ISO) en `line`.

    Los dígitos de una fecha (ej. el `2026` de `05/06/2026`) NO son un monto. Excluirlos
    evita el bug del año-como-monto en líneas etiquetadas (ver `_money_tokens`).
    """
    spans: list[tuple[int, int]] = []
    for rx in (_DATE_ISO, _DATE_DMY):
        spans.extend(m.span() for m in rx.finditer(line))
    return spans


def _money_tokens(line: str) -> list[tuple[float, bool]]:
    """(valor, tiene_centavos) de los tokens de `line` que parecen plata.

    Descarta identificadores: corridas largas de dígitos SIN parte decimal
    (CBU de 22, nº de operación, etc.) y los dígitos que son parte de una fecha.
    """
    if _IDENTIFIER_LINE.search(line):
        return []
    date_spans = _date_spans(line)
    out: list[tuple[float, bool]] = []
    for m in _NUMERIC_TOKEN.finditer(line):
        tok = m.group()
        # Token contenido en una fecha (ej. el año de 05/06/2026): no es un monto.
        if any(lo <= m.start() and m.end() <= hi for lo, hi in date_spans):
            continue
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

    - Transferencia: el de la línea "Importe"/"Monto"/"Enviaste"/… (la etiqueta puede
      estar sola y el monto en la línea siguiente, como en los recibos de billetera).
    - Compra: el de la línea "TOTAL" (no "SUBTOTAL").
    - Si no hay match por etiqueta, gana el mayor monto CON centavos.
    - A.1 (F2-12): si no hay etiqueta NI parte decimal, NO se cae a enteros sueltos
      → vacío. Sin esa señal no hay candidato confiable y preferimos no cargar a
      cargar mal (ej. el año 2026 de un comprobante de billetera de 1 peso). Un monto
      ETIQUETADO sin centavos sí se respeta: la etiqueta es señal suficiente.
    """
    keyword = _AMOUNT_LABEL if subtype == "transfer" else _TOTAL_LINE
    lines = text.splitlines()

    keyed: list[float] = []
    with_cents: list[float] = []
    for i, line in enumerate(lines):
        labeled = bool(keyword.search(line)) and not _SUBTOTAL_LINE.search(line)
        tokens = _money_tokens(line)
        if labeled and not tokens:
            # Recibos mobile (Naranja X, BNA…): la etiqueta va sola y el monto en la
            # línea siguiente. Tomamos el primer monto dentro de las próximas 2 líneas
            # no vacías como monto etiquetado.
            seen = 0
            for nxt in lines[i + 1 :]:
                if not nxt.strip():
                    continue
                ahead = _money_tokens(nxt)
                if ahead:
                    keyed.extend(value for value, _ in ahead)
                    break
                seen += 1
                if seen >= 2:
                    break
            continue
        for value, has_cents in tokens:
            if has_cents:
                with_cents.append(value)
            if labeled:
                keyed.append(value)

    if keyed:
        return max(keyed)
    if with_cents:
        return max(with_cents)
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
# Fechas con el mes en palabra, comunes en billeteras: "22/JUN/2026", "22-jun-26"
# (mes abreviado) y "23 de junio de 2026" (textual).
_DATE_MONTH_SLASH = re.compile(r"\b(\d{1,2})[/\- ]([A-Za-zÁÉÍÓÚáéíóú]{3,})[/\- ](\d{2,4})\b")
_DATE_MONTH_DE = re.compile(
    r"\b(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+de\s+(\d{4})\b", re.IGNORECASE
)
_MONTHS: dict[str, int] = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7,
    "ago": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12,
}


def _month_number(name: str) -> int | None:
    """Mes (1-12) a partir del nombre en español (completo o abreviado), sin acentos."""
    key = "".join(
        c
        for c in unicodedata.normalize("NFKD", name.strip().lower())
        if not unicodedata.combining(c)
    )
    return _MONTHS.get(key) or _MONTHS.get(key[:3])


def extract_date(text: str) -> str | None:
    """Primera fecha válida del texto, en ISO YYYY-MM-DD.

    Reconoce ISO y DMY numérica, y como fallback los formatos con el mes en palabra
    (es) de las billeteras ("22/JUN/2026", "23 de junio de 2026").
    """
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
    for rx in (_DATE_MONTH_SLASH, _DATE_MONTH_DE):
        for m in rx.finditer(text):
            month = _month_number(m.group(2))
            if month is None:
                continue
            day, year = int(m.group(1)), int(m.group(3))
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


# El OCR de los recibos mobile suele anteponer un bullet a la etiqueta y lo lee como
# "o "/símbolo (ej. MP: "o De" / "o Para"). Lo toleramos como prefijo opcional.
_BULLET = r"(?:[•◦·∙*\-•]\s*|[oO]\s+)?"
_ORIGIN_LABEL = re.compile(
    r"^" + _BULLET + r"(?:cuenta\s+origen|nombre\s+remitente|remitente|titular\s+origen"
    r"|ordenante|origen|nombre|de)\b\s*:?\s*(.*)$",
    re.IGNORECASE,
)
_DEST_LABEL = re.compile(
    r"^" + _BULLET + r"(?:cuenta\s+destino|destinatari[oa]|titular\s+destino"
    r"|beneficiari[oa]|destino|para)\b\s*:?\s*(.*)$",
    re.IGNORECASE,
)
_BANK_LABEL = re.compile(
    r"^banco(?:\s*(origen|destino|emisor|receptor))?\s*:?\s*(.*)$", re.IGNORECASE
)
# Lo que sigue al nombre en la misma línea (cuenta/CBU/identificadores), no es el titular.
_HOLDER_STOP = re.compile(r"\b(cbu|cvu|alias|cuit|cuil|dni|cuenta|ca\s*\$)\b", re.IGNORECASE)
# Líneas que son OTRO campo del comprobante, no un nombre de titular. Si una etiqueta
# va sola y la línea siguiente es uno de estos campos, el nombre no está ahí (ej. Ualá
# parte "Nombre remitente" y deja "remitente" solo seguido de "Concepto").
_FIELD_LABEL = re.compile(
    r"^(?:concepto|motivo|importe|monto|fecha|banco|cbu|cvu|alias|cu[ií]t|cu[ií]l|dni"
    r"|id\b|n[º°]|numero|número|c[oó]digo|operaci[oó]n|cuenta|tarjeta|enviaste|recibiste)\b",
    re.IGNORECASE,
)


def _extract_party(text: str, label_re: re.Pattern[str]) -> str | None:
    """Titular de un lado (origen/destino) de una transferencia.

    Soporta el formato clave:valor en una sola línea ("Origen: Juan Perez")
    y el formato de comprobante con la etiqueta sola y el nombre en la línea
    siguiente (lo más común en comprobantes de banco reales).
    """
    lines = text.splitlines()
    for i, line in enumerate(lines):
        m = label_re.match(line.strip())
        if not m:
            continue
        inline = m.group(1).strip()
        if inline:
            cut = _HOLDER_STOP.search(inline)
            name = inline[: cut.start()].strip(" -") if cut else inline
            if name:
                return name
            continue
        for j in range(i + 1, min(i + 4, len(lines))):
            candidate = lines[j].strip()
            if not candidate:
                continue
            # La línea siguiente es OTRO campo (Concepto, Motivo, CBU…): el nombre no
            # está acá → vacío (mejor None que cargar la etiqueta de otro campo).
            if _FIELD_LABEL.match(candidate):
                return None
            return candidate
        return None
    return None


def extract_origin(text: str) -> str | None:
    """Titular de origen de una transferencia (ej. "Origen"/"Ordenante")."""
    return _extract_party(text, _ORIGIN_LABEL)


def extract_dest(text: str) -> str | None:
    """Titular de destino de una transferencia (ej. "Destino"/"Beneficiario")."""
    return _extract_party(text, _DEST_LABEL)


def extract_bank(text: str, side: str) -> str | None:
    """Banco de `side` ('origin'/'dest') de una transferencia, si está en el texto.

    Prioriza una etiqueta explícita ("Banco origen"/"Banco destino"); si no hay,
    cae a una línea "Banco <entidad>" sin calificar dentro del bloque del lado
    pedido (delimitado por las etiquetas Origen/Destino/Importe).
    """
    lines = text.splitlines()
    origin_idx = next((i for i, ln in enumerate(lines) if _ORIGIN_LABEL.match(ln.strip())), None)
    dest_idx = next((i for i, ln in enumerate(lines) if _DEST_LABEL.match(ln.strip())), None)
    amount_idx = next((i for i, ln in enumerate(lines) if _AMOUNT_LABEL.search(ln)), None)

    if side == "origin":
        lo = origin_idx if origin_idx is not None else 0
        hi = dest_idx if dest_idx is not None else len(lines)
        qualifier_wanted = "origen"
    else:
        lo = dest_idx if dest_idx is not None else 0
        hi = len(lines)
        if amount_idx is not None and dest_idx is not None and amount_idx > dest_idx:
            hi = amount_idx
        qualifier_wanted = "destino"

    fallback: str | None = None
    for line in lines[lo:hi]:
        m = _BANK_LABEL.match(line.strip())
        if not m:
            continue
        qualifier = (m.group(1) or "").lower()
        candidate = m.group(2).strip()
        if not candidate:
            continue
        if qualifier:
            if qualifier == qualifier_wanted:
                return candidate
            continue
        fallback = fallback or candidate
    return fallback


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

    origin_holder = origin_bank = dest_holder = dest_bank = None
    if subtype == "transfer":
        origin_holder = extract_origin(text)
        origin_bank = extract_bank(text, "origin")
        dest_holder = extract_dest(text)
        dest_bank = extract_bank(text, "dest")

    confidence = 0.0
    if amount is not None:
        confidence += 0.5
    if occurred is not None:
        confidence += 0.3
    if merchant:
        confidence += 0.2
    # Criterio conservador: solo sube si se reconoció origen junto con el monto.
    if origin_holder and amount is not None:
        confidence = min(1.0, confidence + 0.1)

    return ReceiptExtraction(
        amount=amount,
        currency=currency,
        date=occurred,
        merchant=merchant,
        confidence=round(confidence, 2),
        origin_holder=origin_holder,
        origin_bank=origin_bank,
        dest_holder=dest_holder,
        dest_bank=dest_bank,
    )
