"""Tests del parseo de resúmenes (FR-16): parser puro de Patagonia, dispatcher y route.

El parser corre sobre un fixture de texto ANONIMIZADO (sintético), nunca contra
PDFs reales. El route se prueba mockeando `pdf_to_text` (la extracción del PDF vive
en `app/pdf.py` y necesita pdfplumber, que no se instala en CI).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.parsing import patagonia
from app.parsing.statements import UnsupportedStatementError, parse_statement_text

FIXTURE = (Path(__file__).parent / "fixtures" / "patagonia_tabular.txt").read_text(encoding="utf-8")


def test_matches_patagonia() -> None:
    assert patagonia.matches(FIXTURE) is True
    assert patagonia.matches("un texto cualquiera") is False


def test_close_date_and_grouping() -> None:
    res = parse_statement_text(FIXTURE)
    assert res.statement_close_on == "2026-05-28"
    # Dos tarjetas con header + una "tarjeta" residual para los impuestos al pie.
    assert len(res.cards) == 3
    c1, c2, c3 = res.cards
    assert (c1.account_hint.last4, c1.account_hint.holder) == ("1234", "JUAN PEREZ")
    assert (c2.account_hint.last4, c2.account_hint.holder) == ("5678", "MARIA GOMEZ")
    assert c3.account_hint.last4 is None
    assert c1.account_hint.bank == "Banco Patagonia"
    assert c1.account_hint.network == "visa"


def test_rows_of_first_card() -> None:
    card = parse_statement_text(FIXTURE).cards[0]
    assert len(card.rows) == 4
    pago, compra, cuota, devol = card.rows

    assert pago.kind == "payment"  # "SU PAGO EN PESOS"
    assert pago.occurred_on == "2026-05-11"

    assert compra.kind == "charge"
    assert compra.amount == 6099.0
    assert compra.currency == "ARS"
    assert compra.description == "COMERCIO UNO"
    assert compra.installment is None
    assert compra.ref == "006532"  # nº de comprobante para dedupe (FR-17)

    assert cuota.installment is not None
    assert (cuota.installment.n, cuota.installment.total) == (2, 3)
    assert cuota.description == "COMERCIO CUOTAS"
    assert cuota.amount == 11566.66

    assert devol.kind == "refund"  # sufijo '-' y NO es pago de tarjeta → reintegro
    assert devol.amount == 19016.78
    assert pago.kind == "payment"  # "SU PAGO EN PESOS" → pago del saldo (se excluye)


def test_impuesto_sin_tarjeta() -> None:
    card = parse_statement_text(FIXTURE).cards[2]
    assert len(card.rows) == 1
    assert card.rows[0].description == "IMPUESTO DE SELLOS"  # se limpió el '$' colgante
    assert card.rows[0].amount == 7129.22


def test_unsupported_layout() -> None:
    with pytest.raises(UnsupportedStatementError):
        parse_statement_text("Resumen de otro banco sin el formato conocido")


# --- Route (mockeando la extracción del PDF) -------------------------------

ENDPOINT = "/v1/statements:parse"
DUMMY = {"file": ("r.pdf", b"%PDF-1.4", "application/pdf")}


def test_route_ok(client: TestClient, auth_header, monkeypatch) -> None:
    monkeypatch.setattr("app.routes.statements.pdf_to_text", lambda content, password=None: FIXTURE)
    res = client.post(ENDPOINT, files=DUMMY, headers=auth_header)
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"statement_close_on", "cards"}
    assert body["statement_close_on"] == "2026-05-28"
    assert len(body["cards"]) == 3


def test_route_bad_password(client: TestClient, auth_header, monkeypatch) -> None:
    from app.pdf import PdfPasswordError

    def boom(content, password=None):
        raise PdfPasswordError("clave incorrecta")

    monkeypatch.setattr("app.routes.statements.pdf_to_text", boom)
    res = client.post(ENDPOINT, files=DUMMY, data={"password": "mala"}, headers=auth_header)
    assert res.status_code == 422


def test_route_unsupported(client: TestClient, auth_header, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routes.statements.pdf_to_text", lambda content, password=None: "otro banco"
    )
    res = client.post(ENDPOINT, files=DUMMY, headers=auth_header)
    assert res.status_code == 422
