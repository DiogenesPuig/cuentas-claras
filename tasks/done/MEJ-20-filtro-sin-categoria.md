# MEJ-20 Filtro "Sin categoría" en Movimientos

**Sprint:** Mejoras · **Modelo sugerido:** Sonnet (patrón ya resuelto, replicar) · **Depende de:** —

## Objetivo
Poder filtrar/buscar en Movimientos los gastos/ingresos **sin categoría asignada**.

## Contexto
- `BUG-13` (`tasks/done/`, PR #69) resolvió el caso análogo para **medio**: constante
  `NO_ACCOUNT_FILTER` (`src/features/transactions/filters.ts:20`), mapeada a
  `args.accountIsNull` en `buildTransactionFilterArgs` (`filters.ts:70-86`) y consumida en
  `src/features/transactions/api.ts` con `.is('account_id', null)`. Este ticket es el mismo
  patrón para `category_id`.
- `category_id` es nullable en el schema (`db/schema_fase1.sql:352`,
  `references categories (id) on delete set null`), así que sí puede haber movimientos sin
  categoría.
- Hoy el select de categoría en `src/features/transactions/components/FilterBar.tsx:73-91` solo
  lista `categories.map(...)` + la opción "Todas" (`value=""`); no hay opción de centinela para
  "sin categoría". `filters.ts:79` solo mapea `categoryId` cuando está seteado (sin rama
  `categoryIsNull`). `api.ts:67` solo tiene `.eq('category_id', args.categoryId)`, sin el
  equivalente a `.is('category_id', null)`.
- Ya existen categorías globales **"Otros gastos"/"Otros ingresos"** (`db/schema_fase1.sql`,
  seed ~586-601) — este ticket **no** crea una categoría especial nueva; filtra por
  `category_id IS NULL`, que es un estado distinto de estar categorizado como "Otros".
- Quedó **fuera de este ticket** (idea a futuro, ver `tasks/MEJORAS.md`) la selección múltiple +
  reasignación masiva de categoría para los movimientos sin categoría: no existe hoy
  infraestructura de selección múltiple en `TransactionList`/`TransactionRow`, es una feature
  más grande a diseñar aparte (decisión del usuario, 2026-08-03).

## Archivos a crear/editar
- `src/features/transactions/filters.ts`
- `src/features/transactions/api.ts`
- `src/features/transactions/components/FilterBar.tsx`

## Pasos
1. Agregar constante `NO_CATEGORY_FILTER` en `filters.ts` (mismo patrón que
   `NO_ACCOUNT_FILTER`).
2. En `buildTransactionFilterArgs`, mapear ese centinela a `args.categoryIsNull = true`
   (rama nueva junto al `if (filters.categoryId)` existente).
3. En `api.ts`, agregar `.is('category_id', null)` cuando `args.categoryIsNull` (mismo patrón
   que `accountIsNull`).
4. En `FilterBar.tsx`, agregar la opción "Sin categoría" al select de categoría (junto a
   "Todas" y las categorías del workspace).
5. Verificar que el total por filtro (`MEJ-13`) sigue sumando correctamente con este filtro
   aplicado.

## Criterios de aceptación
- [ ] El filtro de categoría en Movimientos tiene la opción "Sin categoría".
- [ ] Al elegirla, se listan solo los movimientos con `category_id IS NULL`.
- [ ] Combina bien con los demás filtros (fecha, medio, persona) sin romper la query.

## Fuera de alcance
- Selección múltiple / reasignación masiva de categoría (anotado en `tasks/MEJORAS.md` para
  diseñar y ejecutar en un ticket propio).
- Crear una categoría "Sin categoría" real en la base.

## Tests
No requiere lógica pura nueva (es composición de query/filtro); si `filters.ts` ya tiene tests
de `buildTransactionFilterArgs`, sumar el caso `categoryIsNull`.

## Por qué este modelo
Sonnet: el patrón ya está resuelto en `BUG-13`, es replicar la misma forma para `category` en
vez de `account` — sin decisiones de diseño nuevas.
