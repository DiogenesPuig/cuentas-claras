"""Tests del borde del fallback (app/llm.py) con httpx mockeado — sin red real.

Verifica la degradación sin key y el wireo Gemini→parse→ReceiptExtraction.
"""

from __future__ import annotations

import httpx

from app import llm
from app.config import Settings


def _settings(**over) -> Settings:
    base = {"gemini_api_key": None, "llm_provider": "gemini"}
    base.update(over)
    return Settings(**base)


class _FakeResp:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._payload


def _fake_client_factory(payload: dict):
    class _FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, params=None, json=None):
            return _FakeResp(payload)

    return _FakeClient


def test_is_enabled_segun_key():
    assert llm.is_enabled(_settings(gemini_api_key="k")) is True
    assert llm.is_enabled(_settings(gemini_api_key=None)) is False


def test_extract_sin_key_devuelve_none():
    assert llm.extract_with_vision(b"\x89PNG", "image/png", _settings()) is None


def test_extract_con_respuesta_gemini(monkeypatch):
    payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"amount": 1500, "currency": "ARS", '
                            '"date": "2026-06-27", "confidence": 0.9}'
                        }
                    ]
                }
            }
        ]
    }
    monkeypatch.setattr(httpx, "Client", _fake_client_factory(payload))
    result = llm.extract_with_vision(b"\x89PNG", "image/png", _settings(gemini_api_key="k"))
    assert result is not None
    assert result.amount == 1500.0
    assert result.currency == "ARS"
    assert result.date == "2026-06-27"
    assert result.confidence == 0.9


def test_extract_respuesta_vacia_devuelve_none(monkeypatch):
    monkeypatch.setattr(httpx, "Client", _fake_client_factory({"candidates": []}))
    assert llm.extract_with_vision(b"x", "image/png", _settings(gemini_api_key="k")) is None


def test_extract_error_de_red_devuelve_none(monkeypatch):
    def _boom(*a, **k):
        raise RuntimeError("network down")

    monkeypatch.setattr(httpx, "Client", _boom)
    assert llm.extract_with_vision(b"x", "image/png", _settings(gemini_api_key="k")) is None


def test_mime_para_pdf_e_imagen():
    assert llm._mime_for("application/pdf") == "application/pdf"
    assert llm._mime_for("image/png") == "image/png"
    assert llm._mime_for(None) == "image/jpeg"
