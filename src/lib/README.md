# src/lib

Utilidades puras y clientes compartidos. La lógica de negocio vive acá (testeable, sin React).

## Archivos

- `utils.ts` — `cn()`: combina clases y resuelve conflictos de Tailwind (usado por shadcn/ui).
- `supabase.ts` — cliente Supabase tipado (singleton).
- `database.types.ts` — tipos GENERADOS desde el esquema con `supabase gen types` (no editar a mano).
- `money.ts` / `money.test.ts` — `consolidate()`: totales por moneda y consolidado en la moneda base (FR-9b), con una sola cotización por moneda para todo el lote. `consolidateHistorical()` (C13): igual, pero resuelve la cotización de cada movimiento por separado vía un callback `rateFor(currency, date)`, para soportar FX histórico (un movimiento de enero no usa la cotización de junio). Pura, sin red.
- `billing.ts` / `billing.test.ts` — `billingPeriodFor()`: rango del ciclo de facturación al que pertenece una fecha, según el día de cierre de la tarjeta (FR-6b). El día de cierre queda incluido en el período que termina ese día.
- `fx.ts` / `fx.test.ts` (C13) — `buildRateIndex()`/`lookupRate()`: índice de cotizaciones (`fx_rates`) por moneda y búsqueda de la vigente a una fecha (la más reciente `<= fecha`, usando `sell`). `resolveFxDate()`: qué fecha define el FX de un movimiento en moneda extranjera — `charged_on` si está seteado; si no, y el medio es tarjeta de **crédito** con día de cierre, el cierre del ciclo (reusa `billingPeriodFor`); en cualquier otro caso (débito/efectivo/billetera/cuenta/sin medio), `occurred_on` directo.
- `dedupe.ts` / `dedupe.test.ts` (F2-4, FR-17) — clave de deduplicación de movimientos importados: `statementExternalHash(...)` arma un `external_hash` estable (tarjeta+fecha+monto+cuota + comprobante o descripción normalizada) y `normalizeDescription()`. Pura; el índice único `(workspace_id, external_hash)` evita reimportar lo mismo. El comprobante distingue dos compras legítimamente iguales.
- `account-match.ts` / `account-match.test.ts` (F2-5, FR-16b) — match de la tarjeta de un resumen (`account_hint`) contra los medios del workspace: `matchAccount(hint, accounts)` (fuerte por `last4`+red, o por titular+banco si no hay `last4`, ej. Nativa) devuelve `{ matched, candidates }`; `accountDefaultsFromHint(hint)` arma los valores para precargar el alta. Pura, opera sobre una forma mínima (no conoce el tipo `Account` ni Supabase). **Nunca auto-asocia un resumen a una tarjeta de otro banco:** un conflicto de banco (ambos conocidos y distintos) descarta el match; el auto-match por titular exige banco compatible y conocido en ambos lados (si no, queda como candidato para que elija el usuario).
- `category-suggest.ts` / `category-suggest.test.ts` (F2-6, FR-19) — `suggestCategory(description, categories)` sugiere una categoría por comercio con reglas de keyword (substring, case/acento-insensitive; gana la keyword más específica), resolviendo contra las categorías existentes del workspace (acepta varios nombres canónicos, ej. Restaurantes/Comida). Devuelve `null` si no aplica. Pura; la sugerencia siempre es editable (la usan el staging de importación y el alta manual).
- `ingesta.ts` / `ingesta.test.ts` (F2-1) — cliente HTTP PURO del microservicio de ingesta (`services/ingesta`): `extractReceipt(file, {baseUrl, accessToken})` (FR-14) y `parseStatement(file, {…, password?})` (FR-16). No importa Supabase ni React (recibe baseUrl/token como parámetros, para portabilidad); es el único módulo de la web que habla con el micro. `IngestaError` con `status` para los errores. Tests con `fetch` mockeado.

## Contenido previsto

- `format.ts` — formato de moneda/fecha por locale.
