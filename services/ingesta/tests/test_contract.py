"""Forma del contrato `/v1/*` (stubs de F2-1) y límite de tamaño de archivo."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings, get_settings


def test_receipts_extract_shape(client: TestClient, auth_header: dict[str, str]) -> None:
    res = client.post(
        "/v1/receipts:extract",
        files={"file": ("r.jpg", b"\xff\xd8\xff", "image/jpeg")},
        headers=auth_header,
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {
        "amount",
        "currency",
        "date",
        "merchant",
        "confidence",
        "origin_holder",
        "origin_bank",
        "dest_holder",
        "dest_bank",
    }
    assert body["confidence"] == 0.0


def test_upload_size_limit(settings: Settings, auth_header: dict[str, str]) -> None:
    from app.main import app

    small = Settings(
        supabase_jwt_secret=settings.supabase_jwt_secret,
        jwt_audience=settings.jwt_audience,
        max_upload_bytes=10,
    )
    app.dependency_overrides[get_settings] = lambda: small
    try:
        with TestClient(app) as c:
            res = c.post(
                "/v1/receipts:extract",
                files={"file": ("big.bin", b"x" * 100, "application/octet-stream")},
                headers=auth_header,
            )
        assert res.status_code == 413
    finally:
        app.dependency_overrides.clear()
