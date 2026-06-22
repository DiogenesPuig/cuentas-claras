"""`POST /v1/receipts:extract` — OCR de comprobantes (FR-14).

Cascarón fino: valida auth, lee el archivo con límite, hace el OCR (borde IO) y
delega la extracción a la lógica pura (`app.parsing.receipts`). En F2-1 el OCR
todavía no corre (stub); F2-2 lo conecta con Tesseract.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.auth import AuthenticatedUser, require_user
from app.config import Settings, get_settings
from app.ocr import image_or_pdf_to_text
from app.parsing.receipts import extract_from_text
from app.schemas import ReceiptExtraction
from app.uploads import read_upload_limited, run_with_timeout

router = APIRouter(prefix="/v1")


@router.post("/receipts:extract", response_model=ReceiptExtraction)
async def extract_receipt(
    file: UploadFile = File(...),
    _user: AuthenticatedUser = Depends(require_user),
    settings: Settings = Depends(get_settings),
) -> ReceiptExtraction:
    content = await read_upload_limited(file, settings.max_upload_bytes)
    content_type = file.content_type

    def _work(raw: bytes) -> ReceiptExtraction:
        text = image_or_pdf_to_text(raw, content_type)
        return extract_from_text(text)

    return await run_with_timeout(lambda: _work(content), settings.process_timeout_seconds)
