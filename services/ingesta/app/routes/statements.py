"""`POST /v1/statements:parse` — parseo de resúmenes de tarjeta (FR-16).

Cascarón fino: valida auth, lee el archivo con límite y delega a la lógica pura
(`app.parsing.statements`). El PDF puede venir protegido con contraseña: se
recibe en el multipart, se usa para descifrar EN MEMORIA y NUNCA se persiste.
F2-3 implementa el parseo real.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.auth import AuthenticatedUser, require_user
from app.config import Settings, get_settings
from app.parsing.statements import parse_statement
from app.schemas import StatementParse
from app.uploads import read_upload_limited, run_with_timeout

router = APIRouter(prefix="/v1")


@router.post("/statements:parse", response_model=StatementParse)
async def parse_statement_route(
    file: UploadFile = File(...),
    password: str | None = Form(default=None),
    _user: AuthenticatedUser = Depends(require_user),
    settings: Settings = Depends(get_settings),
) -> StatementParse:
    content = await read_upload_limited(file, settings.max_upload_bytes)

    # La password vive solo en este scope; no se loguea ni se guarda.
    def _work() -> StatementParse:
        return parse_statement(content, password=password)

    return await run_with_timeout(_work, settings.process_timeout_seconds)
