# F2-3 Parseo de resúmenes → staging + revisión/confirmación

**Sprint:** Fase 2 · **Modelo sugerido:** Opus (esquema staging + contrato) → Sonnet (ejecuta) · **Depende de:** F2-1, B8

## Objetivo
Subir un resumen de tarjeta (PDF), parsearlo en el microservicio Python y mostrar sus movimientos en una pantalla de **staging** para que el usuario revise, ajuste y confirme antes de crear los movimientos reales en bloque. Bancos objetivo iniciales: **Nación** y **Patagonia** (Visa/Mastercard).

## Contexto (links a docs)
- PRD §5.4 FR-16 (parseo con staging) y §9.4 (FX por `charged_on`). `tasks/fase2/PLAN.md` §2/§4.
- Ya existe: subida a `attachments` (`kind='statement'`), `transactions.source='statement_import'`, `charged_on`.
- `db/schema_fase1.sql`.
- **Referencia local privada:** `samples/resumenes-privados/` (gitignored) tiene resúmenes reales para construir/probar parsers a mano. Los **tests** corren contra fixtures **anonimizados/sintéticos** versionables, no contra los privados (ver `tasks/fase2/PLAN.md` §5).
- **Seguridad:** el PDF es input no confiable → parser defensivo, límites de tamaño/tiempo, sin ejecutar contenido embebido (ver PLAN §5).

## DECISIONES PENDIENTES (resolver al planificar el ticket)
- **Modelo de staging:** tabla `statement_staging` (filas parseadas, `status` pending/confirmed/discarded, FK al `attachment` y al `workspace`, RLS por workspace) vs. staging efímero en el front. Recomendado: **tabla**, para no perder el trabajo y poder confirmar por partes.
- **Cuotas (installments):** los resúmenes AR traen "cuota 3/12". Definir si se modela (campos `installment_n`/`installment_total`) — **puede requerir migración de `transactions`**. Ver brainstorm de Fase 2.
- **Password del PDF:** se pide en el upload y se manda al micro; **nunca se persiste** (verificar en review).

## Archivos a crear/editar
- Migración: `statement_staging` (+ RLS) y, si se decide, columnas de cuotas en `transactions`.
- Micro (F2-1): implementar `POST /v1/statements:parse` con `pdfplumber` + módulos puros por banco (`app/parsing/nacion.py`, `patagonia.py`) y un dispatcher.
- Web: `src/features/imports/` (nuevo) → `api.ts` (subir, llamar al micro, escribir staging, confirmar), `hooks.ts`, `schema.ts`, `components/StatementStaging.tsx`, `components/StagingRow.tsx`; ruta `/importar`.
- READMEs de las carpetas tocadas.

## Pasos
1. Upload del PDF (+ password) → `attachments` (`kind='statement'`).
2. Llamar `POST /v1/statements:parse`; el micro devuelve `{ account_hint, rows[] }`. Si falla el desbloqueo/parseo → `attachment_status='failed'` y mensaje claro.
3. Guardar las filas en `statement_staging` (bajo RLS del usuario).
4. Pantalla de staging: editar/descartar filas, asignar categoría/medio, ver duplicados (F2-4) y el medio detectado (F2-5).
5. Confirmar → crear `transactions` en bloque (`source='statement_import'`), marcar staging `confirmed` y `attachment_status='processed'`.

## Criterios de aceptación
- [ ] Subir un PDF de Nación/Patagonia genera filas en staging con monto/fecha/descripción correctos (fixtures).
- [ ] El usuario puede editar/descartar antes de confirmar; confirmar crea los movimientos en bloque.
- [ ] PDF con password: se desbloquea con la clave correcta; con clave incorrecta → `failed` sin persistir la clave.
- [ ] Toda la escritura respeta RLS por workspace.
- [ ] Lógica pura de parseo testeada con fixtures; `typecheck`/`lint`/`test`/`pytest` ok.

## Fuera de alcance
- Dedupe (F2-4), alta de medio desde staging (F2-5), sugerencia de categoría (F2-6): se integran acá pero se especifican aparte.

## Tests
- `pytest` de los parsers por banco con **fixtures anonimizados** (ver brainstorm: estrategia de fixtures). Web: flujo staging→confirm con micro/api mockeados.

## Por qué este modelo
Opus define el esquema de staging y el contrato de parseo (impactan F2-4/5/6 y posible migración); Sonnet implementa parsers y UI con esas decisiones tomadas.
