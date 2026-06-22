"""Parser del resumen de Nativa Internacional (Banco Nación, Mastercard).

Lógica PURA sobre el texto ya extraído (sin pdfplumber/IO): se testea con un
fixture de texto anonimizado. A diferencia de lo previsto en F2-3b, la capa de
texto del PDF SÍ sale legible (`extract_text` da el detalle completo), así que el
parser trabaja sobre texto como el de Patagonia, no por coordenadas.

Layout (todo en la página del "RESUMEN CONSOLIDADO"):
- `Estado de cuenta al : dd-Mon-aa` → cierre del resumen (charged_on).
- El detalle arranca tras `DETALLE DEL MES ... NRO CUPON PESOS DOLAR`; antes está
  el consolidado (incluye `SU PAGO`), que se ignora.
- Filas: `dd-Mon-aa  DETALLE [NN/NN]  CUPON(4-6díg)  IMPORTE(1234,56)` — los
  importes NO llevan separador de miles (a diferencia de Patagonia).
- Sub-encabezados (`DEBITOS AUTOMATICOS`, `CUOTAS DEL MES`, `COMPRAS DEL MES`) se
  saltan solos (no matchean fila).
- `TOTAL TITULAR <NOMBRE> ...` / `TOTAL ADICIONAL <NOMBRE> ...` cierran el grupo de
  cada tarjeta (titular y adicionales/extensiones, FR-6c); de ahí sale el titular.
  El PAN no aparece en el texto, así que `last4` queda None (F2-5 matchea por titular).
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

# Importe Nativa: dígitos sin separador de miles + ,dd (ej. 24570,00, -5000,00).
_DETAIL_ROW = re.compile(r"^(\d{2})-([A-Za-z]{3})-(\d{2})\s+(.*)$")
_TAIL = re.compile(r"^(?P<desc>.*?)\s+(?P<cupon>\d{4,6})\s+(?P<amount>-?\d+,\d{2})\s*$")
_CUOTA = re.compile(r"\s+(\d{1,2})/(\d{1,2})\s*$")
_TOTAL = re.compile(
    r"^TOTAL\s+(?:TITULAR|ADICIONAL)\s+(?P<holder>.+?)\s+-?\d+,\d{2}\s+-?\d+,\d{2}\s*$",
    re.IGNORECASE,
)
_CLOSE = re.compile(
    r"Estado\s+de\s+cuenta\s+al\s*:?\s*(\d{1,2})-([A-Za-z]{3})-(\d{2})", re.IGNORECASE
)
_PAYMENT_RE = r"\bSU\s+PAGO\b|\bPAGO\s+EN\s+PESOS\b|\bPAGO\s+M[IÍ]NIMO\b"

_MONTHS = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12,
}


def matches(text: str) -> bool:
    """¿El texto parece un resumen de Nativa-Nación (Mastercard)?"""
    return "DETALLE DEL MES" in text and "NRO CUPON" in text


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
    if "mastercard" in low or "master" in low:
        return "mastercard"
    if "visa" in low:
        return "visa"
    return None


def _bank(text: str) -> str | None:
    low = text.lower()
    if "nación" in low or "nacion" in low or "30-50001091-2" in text:
        return "Banco Nación"
    return None


def _parse_row(rest: str) -> StatementRow | None:
    """`rest` es la línea sin la fecha. Devuelve la fila o None si no parsea."""
    tail = _TAIL.match(rest)
    if not tail:
        return None
    value = _parse_amount(tail.group("amount"))
    if value is None:
        return None

    ref = tail.group("cupon")
    description = tail.group("desc").strip(" .-*$")

    installment = None
    cuota = _CUOTA.search(tail.group("desc"))
    if cuota:
        installment = StatementInstallment(n=int(cuota.group(1)), total=int(cuota.group(2)))
        description = tail.group("desc")[: cuota.start()].strip(" .-*$")

    # Pago del saldo (no es gasto → se excluye) vs. reintegro (gasto negativo → netea).
    is_card_payment = bool(re.search(_PAYMENT_RE, description, re.IGNORECASE))
    if is_card_payment:
        kind = "payment"
    elif value < 0:
        kind = "refund"
    else:
        kind = "charge"

    return StatementRow(
        occurred_on=None,  # lo completa el caller con la fecha de la fila
        description=description or None,
        amount=abs(value),  # magnitud; el signo lo aplica el front según `kind`
        currency="ARS",
        installment=installment,
        kind=kind,
        ref=ref,
    )


def parse(text: str) -> StatementParse:
    """Parsea el resumen de Nativa-Nación agrupando filas por titular/adicional."""
    close_on = _close_date(text)
    bank, network = _bank(text), _network(text)

    cards: list[StatementCard] = []
    pending: list[StatementRow] = []
    in_detail = False

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        # El detalle por tarjeta empieza después de este encabezado; antes está el
        # consolidado (con SU PAGO), que no se imputa a ninguna tarjeta.
        if not in_detail:
            if "DETALLE DEL MES" in line:
                in_detail = True
            continue

        total = _TOTAL.match(line)
        if total:
            hint = StatementAccountHint(
                bank=bank, network=network, last4=None, holder=total.group("holder").strip()
            )
            cards.append(StatementCard(account_hint=hint, rows=pending))
            pending = []
            continue

        start = _DETAIL_ROW.match(line)
        if not start:
            continue
        row = _parse_row(start.group(4))
        if row is None:
            continue
        dd, mon, yy = int(start.group(1)), start.group(2).lower(), int(start.group(3))
        month = _MONTHS.get(mon)
        if not month:
            continue
        row.occurred_on = f"{2000 + yy:04d}-{month:02d}-{dd:02d}"
        pending.append(row)

    # Filas sin un TOTAL que las cierre: tarjeta residual sin titular.
    if pending:
        residual = StatementAccountHint(bank=bank, network=network)
        cards.append(StatementCard(account_hint=residual, rows=pending))

    return StatementParse(statement_close_on=close_on, cards=cards)
