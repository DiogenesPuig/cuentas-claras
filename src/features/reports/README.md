# src/features/reports

Pantalla `/reportes`: desglose por dimensión (categoría/persona/banco/red/medio) y comparativa
mes a mes, con consolidado multi-moneda. Implementa **FR-20, FR-21, FR-22, FR-24** (PRD §5.6).

## Archivos

- `api.ts` — Supabase: `listReportTransactions` (movimientos del workspace en un rango de fechas,
  con `account` —incluye banco/red/tipo/holder/extensión/cierre— y `category` joineados),
  `getWorkspaceFxSettings` (moneda base + `fx_source`/`fx_quote` del workspace, C12),
  `listFxRates` (historial de `fx_rates` de las monedas pedidas hasta una fecha). Sin React.
- `aggregate.ts` / `aggregate.test.ts` — lógica pura de agregación:
  - `aggregateByDimension`: agrupa movimientos por dimensión (FR-22) y consolida cada grupo;
    los grupos suman, entre todos, el total del período (con "Sin categoría"/"Sin medio" de
    fallback). "Persona" agrupa por `holder_name` del medio usado (no por titular).
  - `monthlySeries`: comparativa mes a mes (FR-24), un consolidado por mes.
  - `consolidateTransactions`: consolida un lote de movimientos resolviendo el FX de cada uno
    (usa `lib/fx.resolveFxDate` + `lib/money.consolidateHistorical`).
  - `personaAccounts`: para la vista "por persona", mapea cada holder a sus medios marcando
    cuáles son extensiones y de qué titular (FR-22: "se listan sus extensiones y las tarjetas
    titulares de las que cuelgan").
  - `filterReportTransactions`: subconjunto que cumple filtros combinables (persona/categoría/
    medio/banco/red, AND); permite drillear el desglose a una persona/categoría/medio.
  - `personaSpending`: gasto por persona — cuánto aporta cada holder, su `share` (% del gasto
    total) y su categoría dominante (o "Varios" si ninguna supera el 40%). Para "p1 = 50%
    (mayormente en super)".
- `hooks.ts` — react-query: `useWorkspaceFxSettings`, `useReportTransactions(workspaceId, range)`,
  `useFxRates(currencies, fxSource, fxQuote, upTo)` (no dispara query si `currencies` está vacío,
  es decir, todo el período ya está en la moneda base).
- `index.ts` — barrel del feature.
- `components/ReportTabs.tsx` — pills para elegir la dimensión (desglose general y "ver por" del detalle).
- `components/DonutChart.tsx` — torta (Recharts) del gasto consolidado por dimensión. `showLegend`
  apaga la leyenda cuando la info va en una columna aparte (`GroupBreakdown`).
- `components/GroupBreakdown.tsx` — info del gráfico: cada grupo con su color (igual que el donut),
  monto y % del total mostrado. Sirve para el grupo entero o para el subconjunto de un filtro.
- `components/chartColors.ts` — paleta compartida donut/listas (mismo orden → mismo color).
- `components/BarChart.tsx` — barras (Recharts) de ingresos/gastos consolidados mes a mes.
- `components/ConsolidatedTotals.tsx` — totales por moneda original + consolidado en la moneda
  base del workspace (FR-21/FR-9b).
- `components/PersonaBreakdown.tsx` — detalle del gasto por persona: % del total y categoría
  dominante ("mayormente en Super" / "varios"). Acompaña al donut de personas.
- `components/ReportFilterBar.tsx` — filtros combinables y removibles (persona/banco/medio/categoría,
  con "Limpiar") que alimentan el bloque de detalle.

## Layout de la pantalla (C13)

`ReportsPage` se organiza en: **General** (todo el grupo, tabs de dimensión; gráfico a la izquierda
e info a la derecha) · **Detalle por filtro** (filtros apilables → subconjunto + "ver por" dimensión;
info a la izquierda y gráfico a la derecha, invertido; vacío hasta filtrar) · **Mes a mes** (6 meses)
· **Anual** (acumulado del año en curso hasta el mes activo). El filtro alimenta SOLO el detalle.

## FX histórico (cómo se resuelve la cotización de cada movimiento)

En Argentina la cotización real de un gasto en moneda extranjera depende del medio de pago, no
solo de la fecha de la compra (ver `lib/fx.resolveFxDate`):

1. Si el movimiento tiene `charged_on` explícito, se usa tal cual.
2. Si no, y el medio es una tarjeta de **crédito** con `billing_close_day`, se usa el **cierre
   del ciclo** que contiene `occurred_on` (reusa `billing.billingPeriodFor` de C11) — el banco
   aplica esa cotización, no la del día de la compra.
3. En cualquier otro caso (débito, efectivo, billetera, cuenta bancaria, o sin medio), se usa
   `occurred_on` directo (conversión inmediata).

Hasta que exista importación de resúmenes (Fase 2), un gasto en moneda extranjera con tarjeta de
crédito es una **estimación**: el monto real en pesos lo termina fijando el banco al cierre. Esa
importación debería ajustar el movimiento ya cargado en vez de duplicarlo (FR-16/FR-17,
`tasks/fase2/`) — fuera de alcance de C13.

## Fuera de alcance

- Export (FR-23): es C14.
- Importación/parseo de resúmenes y su impacto en el FX "real" (Fase 2, `tasks/fase2/`).
- Escribir `amount_base`/`fx_rate`/`fx_date` en `transactions`: el consolidado se calcula al
  vuelo para mostrarlo, no se persiste en el movimiento.

## Relacionados

- `lib/money` (`consolidateHistorical`) y `lib/fx` (`buildRateIndex`/`lookupRate`/`resolveFxDate`)
  — lógica pura y testeada, reutilizable fuera de Supabase.
- `lib/billing` (`billingPeriodFor`, C11) — de dónde sale el cierre de ciclo de una tarjeta.
- `features/accounts` (`useAccounts`) — lista completa de medios del workspace, para
  `personaAccounts` (necesita ver también medios sin movimientos en el período).
- Tabla `fx_rates` y cron de `fx-refresh` (C12, `supabase/functions/fx-refresh/`).
