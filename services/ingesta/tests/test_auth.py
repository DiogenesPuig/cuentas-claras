"""Auth: el micro rechaza requests sin JWT válido y acepta uno bien firmado."""

from __future__ import annotations

import jwt
import pytest
from fastapi.testclient import TestClient

from app.auth import AuthError, TokenVerifier
from tests.conftest import TEST_SECRET, make_token

ENDPOINT = "/v1/receipts:extract"
DUMMY_FILE = {"file": ("r.txt", b"hola", "text/plain")}


def test_rejects_without_token(client: TestClient) -> None:
    res = client.post(ENDPOINT, files=DUMMY_FILE)
    assert res.status_code == 401


def test_rejects_malformed_header(client: TestClient) -> None:
    res = client.post(ENDPOINT, files=DUMMY_FILE, headers={"Authorization": "Token abc"})
    assert res.status_code == 401


def test_rejects_bad_signature(client: TestClient) -> None:
    bad = jwt.encode({"sub": "x", "aud": "authenticated"}, "wrong-secret", algorithm="HS256")
    res = client.post(ENDPOINT, files=DUMMY_FILE, headers={"Authorization": f"Bearer {bad}"})
    assert res.status_code == 401


def test_rejects_expired(client: TestClient) -> None:
    token = make_token(expired=True)
    res = client.post(ENDPOINT, files=DUMMY_FILE, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_accepts_valid_token(client: TestClient, auth_header: dict[str, str]) -> None:
    res = client.post(ENDPOINT, files=DUMMY_FILE, headers=auth_header)
    assert res.status_code == 200


def test_verifier_unit_hs256() -> None:
    verifier = TokenVerifier(jwt_secret=TEST_SECRET, audience="authenticated")
    user = verifier.verify(make_token(sub="abc"))
    assert user.user_id == "abc"


def test_verifier_rejects_missing_sub() -> None:
    verifier = TokenVerifier(jwt_secret=TEST_SECRET, audience="authenticated")
    token = jwt.encode({"aud": "authenticated"}, TEST_SECRET, algorithm="HS256")
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_verifier_requires_some_config() -> None:
    with pytest.raises(ValueError):
        TokenVerifier()
