# F2-7 Visor de comprobantes

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** B8

## Objetivo
Ver y descargar el comprobante (imagen o PDF) asociado a un movimiento, desde el detalle/lista de movimientos, usando signed URLs del bucket privado. Cierra FR-10/FR-13 a nivel UI. **No necesita el microservicio Python ni infra nueva.**

## Contexto (links a docs)
- PRD §5.4 (FR-13 subir comprobante) y §5.6 (FR-10 ver). `tasks/fase2/PLAN.md` §1 (plomería ya lista).
- Ya existe: `getAttachmentUrl(path)` en `src/features/transactions/api.ts` (signed URL 5 min, bucket privado `attachments`), tabla `attachments` (`file_type` `'image'|'pdf'`, `kind`, `status`), y `transactions.attachment_id`.
- `db/schema_fase1.sql` → `attachments`.

## Archivos a crear/editar
- `src/features/transactions/` → `components/AttachmentViewer.tsx` (nuevo); `hooks.ts` (hook `useAttachmentUrl`); `api.ts` (si falta, un `getAttachment(id)` para resolver `file_url`/`file_type` desde `attachment_id`).
- Enganchar el visor donde se muestra el detalle de un movimiento (lista de B10 / detalle).
- Actualizar `src/features/transactions/README.md`.

## Pasos
1. Dado un movimiento con `attachment_id`, resolver `file_url` (path) y `file_type` desde `attachments`.
2. Hook `useAttachmentUrl` que pide la signed URL on-demand (no al render de la lista; al abrir el visor) y la cachea hasta que expira.
3. `AttachmentViewer`: si `image` → `<img>` con alt; si `pdf` → link "Ver/Descargar" (abrir en pestaña nueva) + ícono. Estado de carga y error (signed URL vencida → reintentar).
4. Accesibilidad: foco, `alt`, navegación por teclado.

## Criterios de aceptación
- [ ] Un movimiento con comprobante imagen lo muestra inline; uno con PDF ofrece ver/descargar.
- [ ] La URL es **signed** y temporal (no se expone el bucket); si expira, se puede reintentar.
- [ ] Un movimiento sin adjunto no rompe (no muestra visor).
- [ ] `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- OCR / extracción de datos (eso es F2-2). Subida de adjuntos (ya existe en B8).

## Tests
- Lógica pura: mapeo `file_type` → modo de render. Componente: render imagen vs pdf vs sin adjunto (con la api mockeada).

## Por qué este modelo
Sonnet: ticket de UI acotado sobre plomería existente, sin decisiones de arquitectura.
