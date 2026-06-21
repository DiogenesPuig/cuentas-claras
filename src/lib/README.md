# src/lib

Utilidades puras y clientes compartidos. La lógica de negocio vive acá (testeable, sin React).

## Archivos

- `utils.ts` — `cn()`: combina clases y resuelve conflictos de Tailwind (usado por shadcn/ui).
- `supabase.ts` — cliente Supabase tipado (singleton).
- `database.types.ts` — tipos GENERADOS desde el esquema con `supabase gen types` (no editar a mano).
- `money.ts` / `money.test.ts` — `consolidate()`: totales por moneda y consolidado en la moneda base (FR-9b). Pura, sin red (las cotizaciones se reciben como parámetro; eso lo resuelve C12).
- `billing.ts` / `billing.test.ts` — `billingPeriodFor()`: rango del ciclo de facturación al que pertenece una fecha, según el día de cierre de la tarjeta (FR-6b). El día de cierre queda incluido en el período que termina ese día.

## Contenido previsto

- `format.ts` — formato de moneda/fecha por locale.
