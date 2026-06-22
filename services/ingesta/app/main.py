"""FastAPI app del microservicio de ingesta (cascarón).

Solo orquesta: CORS, registro de routers y poco más. Toda la lógica real vive en
módulos puros (`app/parsing/`) y el endurecimiento en `app/uploads.py`. Migrar de
runtime = reescribir este cascarón, no la lógica.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import health, receipts, statements

app = FastAPI(
    title="Cuentas Claras — Ingesta",
    version="0.1.0",
    description="OCR de comprobantes y parseo de resúmenes. Stateless: no toca la DB.",
)

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router)
app.include_router(receipts.router)
app.include_router(statements.router)
