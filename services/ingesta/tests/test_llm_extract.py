"""Tests de la lógica pura del fallback por visión (Fase B, F2-12).

Sin red: solo prompt/decisión/parseo/validación/merge.
"""

from __future__ import annotations

from app.parsing.llm_extract import (
    merge,
    parse_llm_json,
    should_use_llm_fallback,
    to_extraction,
)
from app.schemas import ReceiptExtraction

# --- should_use_llm_fallback ----------------------------------------------


def test_fallback_si_no_hay_monto():
    res = ReceiptExtraction(amount=None, confidence=0.0)
    assert should_use_llm_fallback(res, max_confidence=0.5) is True


def test_fallback_si_confianza_baja_aunque_haya_monto():
    res = ReceiptExtraction(amount=1500.0, confidence=0.5)
    assert should_use_llm_fallback(res, max_confidence=0.5) is True


def test_no_fallback_si_fase_a_solida():
    res = ReceiptExtraction(amount=1500.0, confidence=0.8)
    assert should_use_llm_fallback(res, max_confidence=0.5) is False


# --- parse_llm_json --------------------------------------------------------


def test_parse_json_plano():
    data = parse_llm_json('{"amount": 1500.5, "currency": "ars", "date": "2026-06-27"}')
    assert data["amount"] == 1500.5
    assert data["currency"] == "ARS"
    assert data["date"] == "2026-06-27"


def test_parse_json_con_code_fence():
    data = parse_llm_json('```json\n{"amount": 100, "merchant": "Kiosco"}\n```')
    assert data["amount"] == 100.0
    assert data["merchant"] == "Kiosco"


def test_parse_descarta_nulls_textuales_y_vacios():
    data = parse_llm_json('{"amount": 100, "merchant": "null", "origin_holder": "  "}')
    assert data["merchant"] is None
    assert data["origin_holder"] is None


def test_parse_monto_invalido_da_none():
    data = parse_llm_json('{"amount": "no es un numero"}')
    assert data["amount"] is None


def test_parse_monto_string_con_separadores():
    assert parse_llm_json('{"amount": "1.234,56"}')["amount"] == 1234.56
    assert parse_llm_json('{"amount": "35.000"}')["amount"] == 35000.0


def test_parse_sin_monto_descarta_moneda():
    data = parse_llm_json('{"amount": null, "currency": "ARS"}')
    assert data["amount"] is None
    assert data["currency"] is None


def test_parse_fecha_no_iso_da_none():
    assert parse_llm_json('{"date": "27/06/2026"}')["date"] is None


def test_parse_currency_invalida_da_none():
    assert parse_llm_json('{"amount": 10, "currency": "PESOS"}')["currency"] is None


def test_parse_confidence_se_clampea():
    assert parse_llm_json('{"confidence": 2}')["confidence"] == 1.0
    assert parse_llm_json('{"confidence": -1}')["confidence"] == 0.0


def test_parse_texto_no_json_da_dict_vacio():
    assert parse_llm_json("lo siento, no puedo leer la imagen") == {}


# --- to_extraction + merge -------------------------------------------------


def test_to_extraction_arma_modelo():
    res = to_extraction({"amount": 50.0, "date": "2026-01-02", "confidence": 0.9})
    assert isinstance(res, ReceiptExtraction)
    assert res.amount == 50.0
    assert res.confidence == 0.9


def test_merge_completa_campos_vacios_de_fase_a():
    fase_a = ReceiptExtraction(amount=None, merchant="Comercio", confidence=0.2)
    llm = ReceiptExtraction(amount=1500.0, date="2026-06-27", confidence=0.85)
    out = merge(fase_a, llm)
    assert out.amount == 1500.0  # del fallback
    assert out.merchant == "Comercio"  # de Fase A (el fallback lo dejó None)
    assert out.date == "2026-06-27"
    assert out.confidence == 0.85  # la mayor


def test_merge_sin_monto_descarta_moneda():
    fase_a = ReceiptExtraction(amount=None, currency="ARS", confidence=0.1)
    llm = ReceiptExtraction(amount=None, confidence=0.0)
    out = merge(fase_a, llm)
    assert out.amount is None
    assert out.currency is None
