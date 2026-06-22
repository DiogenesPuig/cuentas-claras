"""Fixtures de test: app con auth en modo HS256 (sin red/JWKS) + tokens de prueba."""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app

TEST_SECRET = "test-secret-not-a-real-supabase-secret"
TEST_AUDIENCE = "authenticated"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        supabase_jwt_secret=TEST_SECRET,
        jwt_audience=TEST_AUDIENCE,
        web_origin="http://localhost:5173",
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def make_token(
    *, sub: str = "user-123", audience: str = TEST_AUDIENCE, expired: bool = False
) -> str:
    now = int(time.time())
    payload = {
        "sub": sub,
        "aud": audience,
        "iat": now,
        "exp": now - 60 if expired else now + 3600,
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture
def auth_header() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token()}"}
