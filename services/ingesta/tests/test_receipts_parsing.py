"""Tests de la heurística pura de comprobantes (FR-14), sobre texto fijo.

Los textos imitan lo que devuelve el OCR/PDF de comprobantes reales (anonimizados):
un ticket de compra de comercio y un comprobante de transferencia.
"""

from __future__ import annotations

import pytest

from app.parsing.receipts import (
    detect_subtype,
    extract_amount,
    extract_from_text,
    parse_amount,
)

TICKET = """SUPERMERCADO LA ECONOMIA
Av. Siempre Viva 123 - CUIT 30-12345678-9
Factura B 0001-00012345
Fecha 21/05/2026  Hora 14:32
Leche x2            1.500,00
Pan                   850,50
SUBTOTAL            2.350,50
TOTAL  $          2.350,50
Gracias por su compra
"""

TRANSFER = """Comprobante de transferencia
Banco de la Nacion
Fecha y hora: 05/06/2026 00:56
Nº de operacion: 123456789
Origen: Juan Perez - CBU 0110599520000012345678
Destino: Maria Lopez
CBU destino: 0720000720000098765432
Importe: $ 15.000,00
Concepto: Alquiler
"""


@pytest.mark.parametrize(
    "token,expected",
    [
        ("1.234,56", 1234.56),
        ("2.350,50", 2350.50),
        ("15.000,00", 15000.0),
        ("1234,56", 1234.56),
        ("1234.56", 1234.56),
        ("999", 999.0),
        ("15.000", 15000.0),  # punto = miles (convención AR), no decimal
        ("1.234.567", 1234567.0),
        ("0,00", None),
        ("abc", None),
    ],
)
def test_parse_amount(token: str, expected: float | None) -> None:
    assert parse_amount(token) == expected


TRANSFER_CON_CBU = """Comprobante de transferencia
Banco de la Nacion
Fecha: 05/06/2026
Nº de operación: 123456789012
Origen CBU 0110599520000012345678
Destino: Maria Lopez
CBU destino: 0720000720000098765432
Importe $ 15.000,00
"""


def test_transfer_no_confunde_cbu_con_monto() -> None:
    # El CBU (22 dígitos) y el nº de operación NO deben ganar como monto.
    res = extract_from_text(TRANSFER_CON_CBU)
    assert res.amount == 15000.0


def test_amount_ignora_identificadores_largos() -> None:
    # Aunque no se reconozca la etiqueta, gana el monto con centavos, no el CBU.
    text = "Destino CBU 0720000720000098765432\nTotal abonado: 2.500,00\n"
    assert extract_amount(text, "transfer") == 2500.0


def test_detect_subtype() -> None:
    assert detect_subtype(TRANSFER) == "transfer"
    assert detect_subtype(TICKET) == "purchase"


def test_ticket_extraction() -> None:
    res = extract_from_text(TICKET)
    assert res.amount == 2350.50  # de la línea TOTAL, no SUBTOTAL ni los ítems
    assert res.currency == "ARS"
    assert res.date == "2026-05-21"
    assert res.merchant == "SUPERMERCADO LA ECONOMIA"
    assert res.confidence == 1.0


def test_transfer_extraction() -> None:
    res = extract_from_text(TRANSFER)
    assert res.amount == 15000.0  # de la línea Importe
    assert res.currency == "ARS"
    assert res.date == "2026-06-05"
    assert res.merchant == "Maria Lopez"  # contraparte (Destino)
    assert res.confidence == 1.0


def test_total_beats_subtotal_and_items() -> None:
    # Aunque un ítem sea mayor, gana la línea TOTAL.
    text = "Item caro 9.999,00\nSUBTOTAL 9.999,00\nTOTAL 100,00\n"
    assert extract_amount(text, "purchase") == 100.0


def test_empty_text_zero_confidence() -> None:
    res = extract_from_text("")
    assert res.confidence == 0.0
    assert res.amount is None
    assert res.merchant is None


def test_usd_currency() -> None:
    res = extract_from_text("TIENDA\nFecha 01/01/2026\nTOTAL U$S 50,00\n")
    assert res.currency == "USD"
    assert res.amount == 50.0
