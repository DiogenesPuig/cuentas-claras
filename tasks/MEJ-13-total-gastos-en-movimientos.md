# MEJ-13 Total de gastos en /movimientos (respetando los filtros)

**Sprint:** Mejoras · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
En `/movimientos`, mostrar el **total de los gastos** (y probablemente ingresos) del conjunto
**filtrado**, para no tener que sumar a mano.

## Contexto (causa)
- Pedido del usuario (2026-07-09).
- Hoy `TransactionList` (`src/features/transactions/components/TransactionList.tsx`) dice en el
  comentario "total filtrado arriba", pero **solo muestra el conteo** (`N movimientos`), no la suma.
- La lista ya recibe los movimientos ya filtrados (`transactions`), así que "respetar los filtros"
  sale gratis: se suma sobre ese array.

## Pasos / consideraciones
1. Sumar los montos del set filtrado y mostrarlo arriba (ej. "12 movimientos · Gastos: $X · Ingresos: $Y").
2. **Multi-moneda:** los movimientos pueden estar en distintas monedas. Decidir:
   - mostrar el total **por moneda** (ej. "ARS 120.000 · USD 50"), o
   - consolidar a la moneda base con FX (reusar `lib/money` `consolidate`/`consolidateHistorical`,
     que ya se usan en reportes). Lo más simple y sin FX: por moneda.
3. Mantener la lógica de suma **pura y testeada** si se agrega a `lib/` (o reusar `consolidate`).

## Criterios de aceptación
- [ ] El total mostrado corresponde a los movimientos **filtrados** (cambia al cambiar filtros/mes/búsqueda).
- [ ] Distingue gastos de ingresos.
- [ ] Multi-moneda resuelto de forma clara (por moneda o consolidado).

## Fuera de alcance
- Rediseño de la lista.

## Por qué este modelo
Sonnet: suma sobre datos ya filtrados + presentación; reusa `lib/money`.
