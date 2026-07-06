"""Tests del parseo de resúmenes (FR-16): parser puro de Patagonia, dispatcher y route.

El parser corre sobre un fixture de texto ANONIMIZADO (sintético), nunca contra
PDFs reales. El route se prueba mockeando `pdf_to_text` (la extracción del PDF vive
en `app/pdf.py` y necesita pdfplumber, que no se instala en CI).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.parsing import nativa_nacion, patagonia
from app.parsing.statements import UnsupportedStatementError, parse_statement_text

FIXTURE = (Path(__file__).parent / "fixtures" / "patagonia_tabular.txt").read_text(encoding="utf-8")
NATIVA = (Path(__file__).parent / "fixtures" / "nativa_nacion.txt").read_text(encoding="utf-8")
BNA = (Path(__file__).parent / "fixtures" / "bna_mastercard.txt").read_text(encoding="utf-8")


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


# --- Nativa-Nación (Mastercard, Banco Nación) — F2-3b ----------------------


def test_matches_nativa_and_dispatch() -> None:
    assert nativa_nacion.matches(NATIVA) is True
    # No confunde un layout con el otro.
    assert nativa_nacion.matches(FIXTURE) is False
    assert patagonia.matches(NATIVA) is False


def test_nativa_bank_detected_by_header_markers() -> None:
    # El banco debe quedar seteado aunque el texto no diga "nación" literal (lo identifica
    # por el producto "NATIVA" o el CUIT). Así el front nunca asocia el resumen a otra tarjeta.
    assert nativa_nacion._bank("RESUMEN NATIVA INTERNACIONAL MASTERCARD") == "Banco Nación"
    assert nativa_nacion._bank("CUIT Entidad: 30-50001091-2") == "Banco Nación"
    assert nativa_nacion._bank("BANCO DE LA NACION ARGENTINA") == "Banco Nación"
    assert nativa_nacion._bank("un resumen de otro banco") is None


def test_nativa_normalize_holder() -> None:
    assert nativa_nacion._normalize_holder("PEREZ JUAN TITULAR") == "JUAN PEREZ"
    assert nativa_nacion._normalize_holder("GOMEZ MARIA ADICIONAL") == "MARIA GOMEZ"
    # Sin sufijo TITULAR/ADICIONAL (no debería pasar en el layout real, pero no rompe).
    assert nativa_nacion._normalize_holder("PEREZ JUAN") == "JUAN PEREZ"


def test_nativa_close_date_and_cards() -> None:
    res = parse_statement_text(NATIVA)
    assert res.statement_close_on == "2026-05-21"  # "Estado de cuenta al : 21-May-26"
    # Una tarjeta por titular y por adicional (FR-6c); ignora el consolidado/SU PAGO.
    assert len(res.cards) == 2
    titular, adicional = res.cards
    # El resumen imprime "Apellido Nombre TITULAR/ADICIONAL" (ver `_normalize_holder`):
    # el parser saca el sufijo y muestra el nombre de pila primero.
    assert titular.account_hint.holder == "APELLIDO NOMBRE"
    assert adicional.account_hint.holder == "APELLIDO NOMBRE"
    for c in res.cards:
        assert c.account_hint.bank == "Banco Nación"
        assert c.account_hint.network == "mastercard"
        assert c.account_hint.last4 is None  # el PAN no está en el texto (F2-5 matchea por titular)


def test_nativa_rows_titular() -> None:
    titular = parse_statement_text(NATIVA).cards[0]
    assert len(titular.rows) == 3
    debito, comision, compra = titular.rows

    # La barra dentro de la descripción no se confunde con una cuota.
    assert debito.description == "NAC SE11/0923093600201"
    assert debito.installment is None
    assert debito.amount == 1350.0
    assert debito.ref == "05308"
    assert debito.kind == "charge"

    assert comision.installment is not None
    assert (comision.installment.n, comision.installment.total) == (7, 12)
    assert comision.amount == 24570.0  # sin separador de miles en el origen

    assert compra.description == "TIENDA EJEMPLO SHOPPING"
    assert (compra.installment.n, compra.installment.total) == (6, 6)
    # Reconcilia con el TOTAL TITULAR del resumen.
    assert round(sum(r.amount for r in titular.rows), 2) == 42486.50


def test_nativa_rows_adicional_with_refund() -> None:
    adicional = parse_statement_text(NATIVA).cards[1]
    assert len(adicional.rows) == 4
    devol = adicional.rows[-1]
    assert devol.description == "DEVOLUCION COMERCIO"
    assert devol.kind == "refund"  # importe negativo en el origen
    assert devol.amount == 5000.0  # magnitud positiva; el signo lo aplica el front
    assert devol.ref == "01122"


# --- Banco Nación MasterCard Black: mismo layout que Nativa pero header "DETALLES" (F2-14) ---


def test_matches_bna_and_dispatch() -> None:
    # El encabezado del detalle viene en PLURAL ("DETALLES DEL MES"); antes esto no se
    # reconocía y el resumen quedaba como formato no soportado (sin banco → medio vacío).
    assert nativa_nacion.matches(BNA) is True
    assert patagonia.matches(BNA) is False
    # No debe romper el otro formato (singular).
    assert nativa_nacion.matches(NATIVA) is True


def test_bna_cards_bank_and_close() -> None:
    res = parse_statement_text(BNA)
    assert res.statement_close_on == "2026-06-25"
    # Titular + dos adicionales (uno sin consumos).
    assert len(res.cards) == 3
    for c in res.cards:
        assert c.account_hint.bank == "Banco Nación"  # el bug era este: quedaba sin banco
        assert c.account_hint.network == "mastercard"
        assert c.account_hint.last4 is None
        assert c.account_hint.holder  # el titular se extrae (nombre imperfecto, ver limitación)


def test_bna_rows_and_refund() -> None:
    res = parse_statement_text(BNA)
    titular = res.cards[0]
    assert len(titular.rows) == 2
    assert round(sum(r.amount for r in titular.rows), 2) == 26070.00  # == TOTAL TITULAR

    tercero = res.cards[2]
    cuota = tercero.rows[1]
    assert cuota.description == "AEROLINEA EJEMPLO"
    assert (cuota.installment.n, cuota.installment.total) == (6, 6)
    devol = tercero.rows[-1]
    assert devol.kind == "refund"
    assert devol.amount == 3000.0


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
