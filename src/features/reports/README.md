# src/features/reports

Pantalla `/reportes`: desglose por dimensión (categoría/persona/banco/red/medio) y comparativa
mes a mes, con consolidado multi-moneda. Implementa **FR-20, FR-21, FR-22, FR-24** (PRD §5.6).

## Archivos

- `api.ts` — Supabase: `listReportTransactions` (movimientos del workspace en un rango de fechas,
  con `account` —incluye banco/red/tipo/holder/`owner_member_id`/extensión/cierre— y `category`
  joineados), `getWorkspaceFxSettings` (moneda base + `fx_source`/`fx_quote` del workspace, C12),
  `listFxRates` (historial de `fx_rates` de las monedas pedidas hasta una fecha). Sin React.
- `aggregate.ts` / `aggregate.test.ts` — lógica pura de agregación:
  - `aggregateByDimension`: agrupa movimientos por dimensión (FR-22) y consolida cada grupo;
    los grupos suman, entre todos, el total del período (con "Sin categoría"/"Sin medio" de
    fallback). Cada grupo trae `key` (clave interna) y `label` (lo que se muestra). "Persona"
    agrupa por `owner_member_id` del medio (F2-10: dedup cuando el mismo dueño tiene el nombre
    escrito distinto en cada banco) y cae a `holder_name` normalizado —tildes/orden, ver
    `lib/name-match.normalizeNameKey`— cuando el medio no está ligado a un miembro; recibe
    `memberNameById` (`workspace_members.id` → nombre vivo) para resolver la etiqueta.
  - `dimensionLabelFor`: etiqueta legible de un movimiento para una dimensión (igual a la clave
    salvo "persona", donde puede ser el nombre vivo del miembro). La usan los filtros y las
    opciones de filtro de `ReportsPage` para no mostrar la clave interna `member:<id>`.
  - `monthlySeries`: comparativa mes a mes (FR-24), un consolidado por mes.
  - `consolidateTransactions`: consolida un lote de movimientos resolviendo el FX de cada uno
    (usa `lib/fx.resolveFxDate` + `lib/money.consolidateHistorical`).
  - `personaAccounts`: para la vista "por persona", mapea cada persona (mismo criterio que
    `aggregateByDimension`) a sus medios marcando cuáles son extensiones y de qué titular (FR-22:
    "se listan sus extensiones y las tarjetas titulares de las que cuelgan").
  - `filterReportTransactions`: subconjunto que cumple filtros combinables (los valores de
    filtro son **etiquetas** legibles, no la clave interna). Cada dimensión
    (persona/categoría/medio/banco/red) acepta **varios valores**: dentro de una dimensión se
    combinan con **OR** (ej. categoría = Transporte o Salud) y entre dimensiones con **AND**.
  - `personaSpending`: gasto por persona — `key` (identidad de persona, para apodos MEJ-8), cuánto
    aporta cada persona, su `share` (% del gasto total) y su categoría dominante (o "Varios" si
    ninguna supera el 40%). Para "p1 = 50% (mayormente en super)".
  - `aggregateByPersonaMembersOnly` (MEJ-5): como `aggregateByDimension(..., 'persona', ...)` pero
    colapsa a TODOS los no-miembros (medios sin `owner_member_id` y los sin medio) en una sola
    porción `OTHERS_LABEL` ("Otros"), dejando a cada miembro individual. Para los donut de resumen
    de `/reportes` (gastos por persona e ingresos por persona); el detalle por filtro sigue usando
    `aggregateByDimension` (sin colapsar) para poder ver un no-miembro puntual.
- `hooks.ts` — react-query: `useWorkspaceFxSettings`, `useReportTransactions(workspaceId, range)`,
  `useFxRates(currencies, fxSource, fxQuote, upTo)` (no dispara query si `currencies` está vacío,
  es decir, todo el período ya está en la moneda base).
- `index.ts` — barrel del feature.
- `components/ReportTabs.tsx` — pills para elegir la dimensión (desglose general y "ver por" del detalle).
- `components/DonutChart.tsx` — torta (Recharts) del consolidado por dimensión. `metric`
  (`'expense'`|`'income'`, default gasto; MEJ-5) elige qué grafica cada porción. `complement`
  (MEJ-5) agrega una porción **gris** con la otra métrica del período sin detallar, para que el
  donut de gastos y el de ingresos se vean como espejo (mismo total); `complementPosition`
  (`'start'`|`'end'`) fija el arco para que gastos ocupen el MISMO lugar en ambos (gastos primero
  en los dos: en ingresos el gris va al `'start'`). `showLegend` apaga la leyenda cuando la info va
  en una columna aparte (`GroupBreakdown`).
- `components/GroupBreakdown.tsx` — info del gráfico: cada grupo con su color (igual que el donut),
  monto y % del total mostrado. `metric` (gasto/ingreso, MEJ-5) igual que el donut. Sirve para el
  grupo entero o para el subconjunto de un filtro.
- `components/chartColors.ts` — paleta compartida donut/listas (mismo orden → mismo color).
- `components/BarChart.tsx` — barras (Recharts) de ingresos/gastos consolidados mes a mes.
- `components/ConsolidatedTotals.tsx` — totales por moneda original + consolidado en la moneda
  base del workspace (FR-21/FR-9b).
- `components/PersonaBreakdown.tsx` — detalle del gasto por persona: % del total y categoría
  dominante ("mayormente en Super" / "varios"). Acompaña al donut de personas. Con la prop opcional
  `aliasing` (MEJ-8) muestra el apodo privado de cada persona y permite editarlo inline (✏️).
- `components/ReportFilterBar.tsx` — filtros combinables y removibles (persona/banco/medio/categoría)
  que alimentan el bloque de detalle. Cada select **agrega** un valor y cada elegido queda como
  **chip con "×"**; se pueden apilar varios por dimensión (OR) y combinarlas (AND). "Limpiar" saca todos.
- `components/ReportsSummarySection.tsx` (REF-1) — bloque **[2]/[3]** de `ReportsPage`: donut de
  gastos por dimensión (con tabs) + donut de ingresos por persona, en espejo. Presentacional (recibe
  los grupos ya agregados/con alias); `ReportsPage` solo arma los datos.
- `components/ReportsDetailSection.tsx` (REF-1) — bloque **[4]** "Detalle por filtro": filtros
  apilables + "ver por" + desglose del subconjunto filtrado. Presentacional, igual criterio que arriba.
- `components/ReportsTrendsSection.tsx` (REF-1) — bloques "Mes a mes" y "Anual". Presentacional.

## Layout de la pantalla (C13)

`ReportsPage` se organiza en (MEJ-5): **[1] Ingresos vs gastos** (totales macro del mes, sin
desglose) · **[2] Gastos** (donut por dimensión con tabs) junto a **[3] Ingresos por persona**
(donut de ingresos), lado a lado; ambos donut de resumen muestran **solo a los miembros** y colapsan
a los no-miembros en una porción **"Otros"** (`aggregateByPersonaMembersOnly`) · **[4] Detalle por
filtro** (filtros apilables → subconjunto + "ver por" dimensión; **sin filtro = todo el mes**, nunca
vacío; acá sí se ven los no-miembros individualmente, y en "persona" trae el detalle de medios por
persona) · **Mes a mes** (6 meses) · **Anual** (acumulado del año hasta el mes activo). El filtro
alimenta SOLO el detalle.

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
