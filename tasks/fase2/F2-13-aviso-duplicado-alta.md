# F2-13 Aviso de duplicado al dar de alta un movimiento

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-2 (OCR), B8 (adjuntos). Reusa ideas de F2-4 sin tocar su índice único.

## Objetivo
Que al dar de alta un movimiento (manual o desde comprobante) la app **avise si ya existe uno igual o muy parecido** y deje al usuario decidir, en vez de crearlo sin más. Hoy se puede subir el mismo comprobante dos veces y entra duplicado, inflando los totales.

> **Aviso suave, no bloqueo.** Se muestran los candidatos y el usuario confirma ("Guardar igual") o cancela. Nunca se impide el alta: dos compras legítimamente iguales deben poder cargarse.

## Contexto (links a docs)
- PRD §5.4 FR-17 (espíritu: no duplicar). Difiere de **F2-4**, que cubre **resúmenes de tarjeta** (staging) con `external_hash` + índice único `(workspace_id, external_hash)` → ese es **bloqueo duro** y NO se reusa acá (este aviso es suave).
- Flujo de alta: `src/features/transactions/components/TransactionForm.tsx` (alta manual y por comprobante OCR). El alta real (crear + subir adjunto) la hace el contenedor vía `onSubmit(input, file)`; el OCR vía `onExtractReceipt`.
- Adjuntos: tabla `attachments` (`db/schema_fase1.sql` ~L275). Subida en `transactions/api.ts` `uploadAttachment`.

## Decisión (resuelta por Opus — alcance acordado con el usuario 2026-06-23)
Dos señales combinadas:
1. **Archivo exacto (aviso fuerte):** SHA-256 del contenido del comprobante. Si ya existe un adjunto con el mismo hash en el workspace ligado a un movimiento → "Ya subiste este comprobante" (lista el/los movimientos).
2. **Movimiento parecido (aviso suave):** mismo **monto + moneda**, `occurred_on` dentro de **±2 días**, y como refuerzo (no requisito) mismo **medio** (`account_id`) o **descripción normalizada** parecida → "Hay un movimiento parecido".

**Alcance:** toda alta por `TransactionForm` (manual + comprobante). Los resúmenes (bulk) ya tienen F2-4 y quedan fuera.
**Ventana de fecha:** ±2 días, en una constante (`SIMILAR_DATE_WINDOW_DAYS`). Sólo en **alta nueva** (no en edición).

## Cambios de esquema (migración nueva)
- `alter table attachments add column content_hash text;`
- `create index idx_attachments_ws_hash on attachments (workspace_id, content_hash) where content_hash is not null;` (NO único: es para buscar, no para bloquear).
- Regenerar `database.types.ts` y `supabase db push` (ver Definition of Done en CLAUDE.md).

## Archivos a crear/editar
- **`src/lib/duplicate-detect.ts`** (nuevo, puro y testeado): dado el input del alta y una lista de movimientos existentes, devuelve los candidatos parecidos con su motivo (`'same-file' | 'amount-date' | 'amount-date-account' | 'amount-date-desc'`). Sin red ni Supabase. Incluye la normalización de descripción (reusar `normalizeDescription` de `lib/dedupe.ts`) y el filtro por ventana de fecha.
- **`src/lib/file-hash.ts`** (nuevo, testeable): `sha256Hex(bytes: ArrayBuffer): Promise<string>` con `crypto.subtle`. Puro respecto de Supabase. (Si `crypto.subtle` no está, devolver `null` y degradar a sólo "parecido".)
- **`transactions/api.ts`**: `findDuplicateCandidates(workspaceId, { amount, currency, occurredOn, accountId, description, contentHash })` → query a `transactions` (rango de fecha + monto/moneda) y a `attachments` por `content_hash`, devolviendo los movimientos candidatos (con datos para mostrar). `uploadAttachment` pasa a guardar `content_hash`.
- **`transactions/hooks.ts`**: hook que expone la búsqueda de candidatos (o se llama on-demand al confirmar; ver Pasos).
- **`TransactionForm.tsx`**: antes de crear, calcular hash del archivo (si hay) y buscar candidatos; si hay, mostrar un panel con la lista (monto, fecha, descripción, medio, "ver comprobante" si tiene) y botones **"Guardar igual"** / **"Cancelar"**. Sin candidatos → alta directa como hoy.
- READMEs de `lib/` y `transactions/` actualizados (regla de índice por carpeta).

## Pasos
1. Migración + tipos.
2. `lib/file-hash.ts` + test.
3. `lib/duplicate-detect.ts` + test (matching, ventana de fecha, motivos, normalización).
4. `api.ts`: `findDuplicateCandidates` y `content_hash` en `uploadAttachment`.
5. `TransactionForm`: al hacer submit por primera vez, si hay candidatos, mostrar el panel y frenar; al confirmar ("Guardar igual"), seguir con `onSubmit`. Estado tipo "pendiente de confirmación".
6. `typecheck` / `lint` / `test`.

## Criterios de aceptación
- [ ] Subir el **mismo comprobante** dos veces avisa "Ya subiste este comprobante" y muestra el movimiento existente; sólo se crea si el usuario confirma.
- [ ] Cargar (manual o por comprobante) un movimiento con **mismo monto+moneda y fecha dentro de ±2 días** muestra el/los parecidos y pide confirmación.
- [ ] Confirmar ("Guardar igual") crea el movimiento; cancelar no crea nada y deja el formulario intacto.
- [ ] Dos movimientos sin coincidencia no disparan ningún aviso (sin fricción en el caso normal).
- [ ] En **edición** de un movimiento existente no se dispara el aviso.
- [ ] `lib/duplicate-detect.ts` y `lib/file-hash.ts` testeados; migración aplicada (`supabase migration list --linked`) y tipos regenerados; `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- Dedupe de resúmenes (ya es F2-4) y su índice único `external_hash`.
- Merge/edición de duplicados existentes ya cargados (sólo prevención en el alta).
- Detección "fuzzy" de imágenes distintas del mismo comprobante (otra foto) — sólo hash exacto del archivo + heurística por datos.

## Tests
- `lib/file-hash.test.ts`: bytes conocidos → hash esperado; mismo contenido → mismo hash.
- `lib/duplicate-detect.test.ts`: match por archivo; por monto+fecha en ventana; fuera de ventana no matchea; refuerzo por medio/descr; motivos correctos.

## Por qué este modelo
Sonnet: lógica pura acotada + una migración chica ya definida + integración en una pantalla existente, con el criterio de match ya resuelto por Opus.
