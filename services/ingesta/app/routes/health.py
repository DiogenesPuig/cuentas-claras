"""Health check público (sin auth): para el smoke test y el chequeo del hosting."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import HealthResponse

router = APIRouter(prefix="/v1")


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()
