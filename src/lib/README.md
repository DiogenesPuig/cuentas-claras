# src/lib

Utilidades puras y clientes compartidos. La lógica de negocio vive acá (testeable, sin React).

## Archivos

- `utils.ts` — `cn()`: combina clases y resuelve conflictos de Tailwind (usado por shadcn/ui).
- `supabase.ts` — cliente Supabase tipado (singleton).
- `database.types.ts` — tipos GENERADOS desde el esquema con `supabase gen types` (no editar a mano).

## Contenido previsto

- `money.ts` — consolidación multi-moneda (pura, testeada). [C11]
- `billing.ts` — ciclo de cierre / período (pura, testeada). [C11]
- `format.ts` — formato de moneda/fecha por locale. [C11]
