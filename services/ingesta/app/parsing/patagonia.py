"""Parser del resumen tabular de Banco Patagonia ("VISA SIGNATURE" / Visa / Master).

Lógica PURA sobre el texto ya extraído (sin pdfplumber/IO): se testea con fixtures
de texto anonimizado. Cubre los layouts tabulares vistos en muestras reales
(Patagonia Visa y Master, y los resúmenes Visa "CR"). El layout Nativa-Nación
(Mastercard, por coordenadas) es otro parser → F2-3b.

Estructura:
- `CIERRE ACTUAL: dd Mon aa` → imputación del resumen (charged_on).
- Filas: `dd.mm.aa  [COMPROB(6díg+*/K)]  DETALLE [Cuota NN/NN]  IMPORTE(1.234,56)[-]`.
- `Tarjeta NNNN Total Consumos de <NOMBRE> ...` cierra el grupo de la tarjeta
  (de ahí salen last4 + titular); las filas previas pertenecen a esa tarjeta.
- Sufijo `-` en el importe = pago/devolución (`kind='payment'`).
"""

from __future__ import annotations

import re

from app.schemas import (
    StatementAccountHint,
    StatementCard,
    StatementInstallment,
    StatementParse,
    StatementRow,
)

# Importe AR: 1.234,56 (con el `(?!\d)` evita tomar tasas tipo "1388,000").
_MONEY = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)")
_ROW_START = re.compile(r"^(\d{2})\.(\d{2})\.(\d{2})\s+(.*)$")
_COMPROBANTE = re.compile(r"^(\d{4,6}[*K]?)\s+(.*)$")
_CUOTA = re.compile(r"\bCuota\s+(\d{1,2})\s*/\s*(\d{1,2})\b", re.IGNORECASE)
_CARD_HEADER = re.compile(
    r"Tarjeta\s+(\d{4})\s+Total\s+Consumos\s+de\s+(.+?)\s+\d{1,3}(?:\.\d{3})*,\d{2}",
    re.IGNORECASE,
)
_CLOSE = re.compile(r"CIERRE\s+ACTUAL:?\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})", re.IGNORECASE)

_MONTHS = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12,
}


def matches(text: str) -> bool:
    """¿El texto parece un resumen tabular de Patagonia?"""
    return "Total Consumos de" in text and "DETALLE DE TRANSACCION" in text


def _parse_amount(token: str) -> float | None:
    try:
        return float(token.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def _close_date(text: str) -> str | None:
    m = _CLOSE.search(text)
    if not m:
        return None
    day, mon, yy = int(m.group(1)), m.group(2).lower(), int(m.group(3))
    month = _MONTHS.get(mon)
    if not month:
        return None
    return f"{2000 + yy:04d}-{month:02d}-{day:02d}"


def _network(text: str) -> str | None:
    low = text.lower()
    if "master" in low or "mc1002" in low:
        return "mastercard"
    if "visa" in low:
        return "visa"
    return None


def _bank(text: str) -> str | None:
    return "Banco Patagonia" if "patagonia" in text.lower() else None


def _parse_row(rest: str) -> StatementRow | None:
    """`rest` es la línea sin la fecha. Devuelve la fila o None si no parsea."""
    body = rest
    comp = _COMPROBANTE.match(body)
    if comp:
        body = comp.group(2)

    money = list(_MONEY.finditer(body))
    if not money:
        return None
    first = money[0]
    amount = _parse_amount(first.group(0))
    if amount is None:
        return None

    # Sufijo '-' pegado al importe (pesos) = crédito (pago de tarjeta o reintegro).
    has_minus = body[first.end() : first.end() + 1] == "-"

    description = body[: first.start()].strip(" .-$")
    installment = None
    cuota = _CUOTA.search(description)
    if cuota:
        installment = StatementInstallment(n=int(cuota.group(1)), total=int(cuota.group(2)))
        description = (description[: cuota.start()] + description[cuota.end() :]).strip(" .-$")

    # Pago del saldo de la tarjeta (no es gasto → se excluye) vs. reintegro/devolución
    # (revierte una compra → gasto negativo que netea).
    _payment_re = r"\bSU\s+PAGO\b|\bPAGO\s+EN\s+PESOS\b|\bPAGO\s+M[IÍ]NIMO\b"
    is_card_payment = bool(re.search(_payment_re, description, re.IGNORECASE))
    if is_card_payment:
        kind = "payment"
    elif has_minus:
        kind = "refund"
    else:
        kind = "charge"

    return StatementRow(
        occurred_on=None,  # lo completa el caller con la fecha de la fila
        description=description or None,
        amount=amount,
        currency="ARS",
        installment=installment,
        kind=kind,
    )


def parse(text: str) -> StatementParse:
    """Parsea el resumen tabular de Patagonia agrupando filas por tarjeta."""
    close_on = _close_date(text)
    bank, network = _bank(text), _network(text)

    cards: list[StatementCard] = []
    pending: list[StatementRow] = []

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        header = _CARD_HEADER.search(line)
        if header:
            hint = StatementAccountHint(
                bank=bank,
                network=network,
                last4=header.group(1),
                holder=header.group(2).strip(),
            )
            cards.append(StatementCard(account_hint=hint, rows=pending))
            pending = []
            continue

        start = _ROW_START.match(line)
        if not start:
            continue
        if "SALDO ANTERIOR" in line.upper():
            continue
        row = _parse_row(start.group(4))
        if row is None:
            continue
        dd, mm, yy = int(start.group(1)), int(start.group(2)), int(start.group(3))
        row.occurred_on = f"{2000 + yy:04d}-{mm:02d}-{dd:02d}"
        pending.append(row)

    # Filas sin un "Total Consumos de" que las cierre (ej. impuestos al pie): tarjeta sin hint.
    if pending:
        residual = StatementAccountHint(bank=bank, network=network)
        cards.append(StatementCard(account_hint=residual, rows=pending))

    return StatementParse(statement_close_on=close_on, cards=cards)
