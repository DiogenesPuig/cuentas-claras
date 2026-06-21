# F2-2 OCR de comprobantes

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-1, B8

## Objetivo
Al subir un comprobante (imagen/PDF), extraer automáticamente **monto, fecha y comercio** y **precargar el formulario** de alta de movimiento para que el usuario confirme/ajuste. OCR on-box con **Tesseract** (decidido en el plan).

## Contexto (links a docs)
- PRD §5.4 FR-14. `tasks/fase2/PLAN.md` §2/§3 (Tesseract on-box).
- Ya existe: subida a `attachments` (`kind='receipt'`) y `transactions.source='ocr'`.
- El micro (F2-1) expone `POST /v1/receipts:extract`.

## Archivos a crear/editar
- Micro (F2-1): implementar `/v1/receipts:extract` con `pytesseract` + heurísticas de extracción (módulo puro `app/parsing/receipts.py`).
- Web: en el alta de movimiento (B8), botón "Subir comprobante" → sube, llama al micro, precarga monto/fecha/comercio (editable); muestra `confidence` bajo como aviso.
- READMEs tocados.

## Pasos
1. En el micro: imagen/PDF → texto (Tesseract) → extraer monto (regex de moneda), fecha (varios formatos) y comercio (heurística por encabezado). Devolver `confidence`.
2. En la web: integrar en el form de alta — subir, llamar, precargar, dejar editar. Si la extracción falla o `confidence` baja, avisar y permitir carga manual.
3. Guardar el adjunto asociado al movimiento creado (`source='ocr'`).

## Criterios de aceptación
- [ ] Subir un comprobante legible precarga monto/fecha/comercio razonables; todo editable antes de guardar.
- [ ] Comprobante ilegible / extracción fallida → no rompe, cae a carga manual con aviso.
- [ ] La lógica de extracción vive en un módulo puro testeado con fixtures (`pytest`).
- [ ] `typecheck`/`lint`/`test` ok en la web.

## Fuera de alcance
- Parseo de resúmenes (F2-3). Motor OCR cloud (se quedó en Tesseract on-box; reabrir solo si la calidad no alcanza).

## Tests
- `pytest` de `receipts.py` con fixtures de imágenes/recibos anonimizados (montos/fechas/comercios variados). Web: form precargado con micro mockeado.

## Por qué este modelo
Sonnet: una vez que F2-1 y el motor (Tesseract) están definidos, es integración + heurísticas acotadas.
