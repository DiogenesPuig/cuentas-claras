# B8 Alta/edición de movimientos

**Sprint:** B · **Modelo sugerido:** Sonnet · **Depende de:** B6, B7

## Objetivo
Formulario de alta rápida (y edición) de ingresos/gastos, multi-moneda, con la persona deducida del medio.

## Contexto
- `db/schema_fase1.sql` → `transactions` (type, amount, currency, amount_base, fx_rate, fx_date, occurred_on, charged_on, description, category_id, account_id, created_by, source, is_shared, attachment_id, external_hash).
- `PRD.md` §5.3 (FR-7, FR-7b/persona vía medio, FR-9 multi-moneda, FR-10 adjunto).
- `PLAN_TECNICO_FASE1.md` §5 (capa de datos), §9 (zod).
- `wireframes/wireframes_fase1.html` pantalla 3 (sin selector "quién gastó").

## Archivos a crear/editar
- `src/features/transactions/` → `api.ts`, `hooks.ts`, `schema.ts`, `components/TransactionForm`.

## Pasos
1. `transactionSchema` (zod) según `PLAN_TECNICO_FASE1.md` §9.
2. `TransactionForm`: toggle Gasto/Ingreso, monto + moneda, motivo, categoría (`useCategories`), medio (`useAccounts`), fecha (`occurred_on`, default hoy), "se cobra" (`charged_on`, opcional), adjuntar comprobante (opcional, sube a Storage y guarda `attachment_id`).
3. `createTransaction` / `updateTransaction` con invalidación de queries.
4. La **persona NO se elige**: se deduce del `account` (su holder). Para movimientos sin medio, queda sin persona.
5. `source = 'manual'`. `created_by = auth.uid()`.

## Criterios de aceptación
- [ ] Se puede crear un gasto con monto+motivo en <10 s (foco automático en monto, fecha=hoy).
- [ ] Se puede crear un ingreso y un movimiento en moneda distinta a la base.
- [ ] Adjuntar comprobante opcional funciona (Storage + `attachment_id`).
- [ ] Editar y eliminar respeta permisos (autor o admin/owner).
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- OCR del comprobante (fase 2). Solo se guarda el archivo.
- Conversión a moneda base (la hace C11/reportes); acá solo se guarda monto+moneda original (y `charged_on`).
- **Ver/visualizar un comprobante ya subido:** B8 solo permite *subir* el archivo (Storage + `attachment_id`);
  todavía **no hay UI para mostrarlo/descargarlo**. La plomería ya existe (`getAttachmentUrl` genera signed URLs
  del bucket privado), falta solo la vista. No es prioritario hoy; queda rezagado a cuando la app esté funcionando
  → ticket **`F2-7`** en `tasks/fase2/README.md` (podría adelantarse a B10 si se quiere antes).

## Tests
- Smoke test del form: validación (monto > 0, moneda 3 letras), default de fecha.

## Por qué este modelo
Sonnet: es el corazón del MVP, con validación y varias relaciones; merece un implementador sólido.
