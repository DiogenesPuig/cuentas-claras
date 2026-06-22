"""Endurecimiento del manejo de archivos subidos (input no confiable).

El micro recibe PDFs/imágenes de cualquiera: aplicamos un límite de tamaño al
leer (corta apenas se excede, no después de cargar todo en memoria) y un wrapper
para acotar el tiempo de procesado. El parseo real (F2-2/F2-3) corre en un
threadpool con timeout para que un archivo malicioso/lento no cuelgue el worker.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import TypeVar

from fastapi import HTTPException, UploadFile, status

T = TypeVar("T")

_CHUNK = 64 * 1024


async def read_upload_limited(file: UploadFile, max_bytes: int) -> bytes:
    """Lee el archivo en chunks y aborta con 413 si supera `max_bytes`."""
    buf = bytearray()
    while chunk := await file.read(_CHUNK):
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"El archivo supera el máximo de {max_bytes} bytes.",
            )
    return bytes(buf)


async def run_with_timeout(func: Callable[[], T], timeout_seconds: float) -> T:
    """Corre `func` (CPU-bound, sin red) en un thread con timeout.

    Aísla el parseo del event loop y evita que un archivo lento cuelgue el worker.
    """
    try:
        return await asyncio.wait_for(asyncio.to_thread(func), timeout=timeout_seconds)
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El procesado del archivo tardó demasiado y se abortó.",
        ) from exc
