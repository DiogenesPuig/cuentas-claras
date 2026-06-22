# F2-4 Detección de duplicados al importar

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-3

## Objetivo
Al importar movimientos desde un resumen (staging), detectar los que ya existen para no duplicarlos: por **monto + fecha + comercio/descripción** (y medio), reusando `transactions.external_hash`. Marcar los duplicados en el staging para que el usuario decida.

## Contexto (links a docs)
- PRD §5.4 FR-17. `tasks/fase2/PLAN.md` §4.
- Ya existe `transactions.external_hash`; F2-3 crea `statement_staging`.

## DECISIÓN PENDIENTE
- **Definición de la clave de dedupe.** Recomendado: hash normalizado de `(workspace_id, account_id, occurred_on/charged_on, amount, normalize(description))`. Definir normalización de descripción y la tolerancia de fecha (¿exacta o ±N días?). Lógica pura en `lib/`.

## Archivos a crear/editar
- `src/lib/dedupe.ts` (nuevo, puro y testeado): cálculo del `external_hash` y comparación.
- `src/features/imports/` → integrar dedupe en el staging (api/hooks/components).
- Al confirmar, escribir `external_hash` en los `transactions` creados.

## Pasos
1. Definir y testear la función de hash/normalización en `lib/dedupe.ts`.
2. Al cargar el staging, calcular el hash de cada fila y compararlo contra los `transactions` existentes del workspace (y contra otras filas del mismo lote).
3. Marcar visualmente los duplicados (y opción "omitir duplicados al confirmar").
4. Persistir `external_hash` en los movimientos creados para futuras importaciones.

## Criterios de aceptación
- [x] Reimportar el mismo resumen no crea duplicados (quedan marcados "ya importado", destildados, y filtrados al confirmar).
- [x] Dos movimientos legítimamente iguales pero distintos no se marcan erróneamente (el hash incluye el **nº de comprobante**); además el usuario puede re-tildar para forzar el alta.
- [x] `lib/dedupe.ts` testeado; `typecheck`/`lint`/`test`/`pytest`/`ruff` ok.

## Estado
Hecho (2026-06-22). Clave: `statementExternalHash` en `lib/dedupe.ts` (tarjeta+fecha+monto+cuota + comprobante/descr). El parser del micro ahora devuelve `ref` (comprobante). Persistido en `transactions.external_hash` (índice único ya existía). Fecha **exacta** (sin tolerancia ±N).

## Fuera de alcance
- El parseo en sí (F2-3) y el alta de medio (F2-5).

## Tests
- `lib/dedupe.test.ts`: mismas entradas → mismo hash; normalización de descripción; colisiones esperadas/no esperadas.

## Por qué este modelo
Sonnet: lógica pura acotada + integración en una pantalla existente, con la clave de dedupe ya definida.
