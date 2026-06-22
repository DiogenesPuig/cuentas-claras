"""`POST /v1/statements:parse` — parseo de resúmenes de tarjeta (FR-16).

Cascarón fino: valida auth, lee el archivo con límite, extrae el texto del PDF
(`app.pdf`, con la password en memoria) y delega al dispatcher puro
(`app.parsing.statements`). La password NUNCA se persiste ni se loguea.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.auth import AuthenticatedUser, require_user
from app.config import Settings, get_settings
from app.parsing.statements import UnsupportedStatementError, parse_statement_text
from app.pdf import PdfPasswordError, PdfReadError, pdf_to_text
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
        text = pdf_to_text(content, password=password)
        return parse_statement_text(text)

    try:
        return await run_with_timeout(_work, settings.process_timeout_seconds)
    except (PdfPasswordError, UnsupportedStatementError) as exc:
        # 422: la web lo trata como 'failed' y ofrece reintentar (ej. con la clave).
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    except PdfReadError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
