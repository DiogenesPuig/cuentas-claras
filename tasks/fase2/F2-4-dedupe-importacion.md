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
- [ ] Reimportar el mismo resumen no crea duplicados (quedan marcados/omitidos).
- [ ] Dos movimientos legítimamente iguales pero distintos (mismo monto/fecha en compras diferentes) no se marcan erróneamente, o el usuario puede forzar el alta.
- [ ] `lib/dedupe.ts` testeado; `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- El parseo en sí (F2-3) y el alta de medio (F2-5).

## Tests
- `lib/dedupe.test.ts`: mismas entradas → mismo hash; normalización de descripción; colisiones esperadas/no esperadas.

## Por qué este modelo
Sonnet: lógica pura acotada + integración en una pantalla existente, con la clave de dedupe ya definida.
