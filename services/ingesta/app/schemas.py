"""Contrato HTTP del micro (forma de las respuestas).

Versionado en el path (`/v1/`). En F2-1 los endpoints devuelven stubs con esta
forma; F2-2 (comprobantes) y F2-3 (resúmenes) la completan con lógica real.
La lógica pura de extracción vive en `app/parsing/` y devuelve estos modelos.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ReceiptExtraction(BaseModel):
    """Resultado de `POST /v1/receipts:extract` (FR-14)."""

    amount: float | None = Field(default=None, description="Monto detectado")
    currency: str | None = Field(default=None, description="Moneda ISO-4217, ej. ARS")
    date: str | None = Field(default=None, description="Fecha en ISO YYYY-MM-DD")
    merchant: str | None = Field(default=None, description="Comercio detectado")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confianza 0..1")


class StatementInstallment(BaseModel):
    n: int = Field(description="Número de cuota cobrada")
    total: int = Field(description="Total de cuotas del plan")


class StatementRow(BaseModel):
    """Una fila parseada del resumen (un movimiento candidato)."""

    occurred_on: str | None = Field(default=None, description="Fecha del consumo (ISO)")
    description: str | None = None
    amount: float | None = None
    currency: str | None = None
    installment: StatementInstallment | None = None


class StatementAccountHint(BaseModel):
    """Pistas para identificar/crear el medio (FR-16b)."""

    bank: str | None = None
    network: str | None = None
    last4: str | None = None
    holder: str | None = None


class StatementParse(BaseModel):
    """Resultado de `POST /v1/statements:parse` (FR-16)."""

    account_hint: StatementAccountHint = Field(default_factory=StatementAccountHint)
    rows: list[StatementRow] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "cuentas-claras-ingesta"
