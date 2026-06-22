# F2-0 Modelar cuotas (installments) en `transactions`

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet (decisión de modelo ya tomada) · **Depende de:** A2

## Objetivo
Soportar compras en cuotas a nivel de datos, como prerequisito de F2-3 (parseo de resúmenes). Decisión ya tomada (ver `tasks/fase2/PLAN.md` §3): **cada fila del resumen es un movimiento por la cuota cobrada ese mes** (no se guarda la compra completa con un plan a derivar). Solo falta la metadata para mostrar/agrupar.

## Contexto (links a docs)
- `tasks/fase2/PLAN.md` §3 (decisión de cuotas) y §4 (orden).
- Confirmado en muestras reales: las filas traen `Cuota NN/NN` (ver F2-3 → "Hallazgos de formato").
- `db/schema_fase1.sql` → tabla `transactions`. `CLAUDE.md` → "Tipos de la DB" (regenerar) y DoD de migraciones (aplicar en remoto).

## Archivos a crear/editar
- `supabase/migrations/0007_transactions_installments.sql` (nuevo).
- `db/schema_fase1.sql` (espejar las columnas para que el esquema de referencia quede al día).
- `src/lib/database.types.ts` (regenerar con `supabase gen types`; si no hay Docker/CLI, ajustar a mano y dejar nota para regenerar).
- READMEs de las carpetas tocadas si corresponde.

## Pasos
1. Migración: agregar a `transactions` dos columnas **nullables**:
   - `installment_n smallint` — número de cuota (ej. 2).
   - `installment_total smallint` — total de cuotas (ej. 3).
   - Check opcional: `installment_n >= 1 and installment_n <= installment_total` cuando ambas no son null.
2. Espejar en `db/schema_fase1.sql`.
3. Aplicar la migración en el proyecto remoto (`supabase db push`) y verificar con `supabase migration list --linked`.
4. Regenerar `database.types.ts` (o ajustar a mano + nota).

## Criterios de aceptación
- [ ] `transactions` tiene `installment_n` / `installment_total` nullables; un movimiento sin cuotas las deja en `null` (no rompe nada existente).
- [ ] Migración **aplicada en remoto** (no solo escrita) y reflejada en `schema_fase1.sql`.
- [ ] `database.types.ts` incluye las columnas nuevas; `typecheck`/`lint`/`test` ok.
- [ ] El check de rango (si se incluye) no rechaza movimientos sin cuotas.

## Fuera de alcance
- El parseo que las completa (F2-3) y la UI de alta manual de cuotas (se evalúa en B8/F2-3). Acá solo el soporte de datos.

## Tests
- No hay lógica pura nueva; la validación es que el esquema migre limpio y los tipos compilen. Si se agrega un helper de formato "2/3", testearlo en `lib/`.

## Por qué este modelo
Sonnet: la decisión de modelado ya está tomada (Opus, en el PLAN); esto es una migración acotada + regenerar tipos.
