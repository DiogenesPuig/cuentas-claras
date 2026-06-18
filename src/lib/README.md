# src/lib

Utilidades puras y clientes compartidos. La lógica de negocio vive acá (testeable, sin React).

## Archivos

- `utils.ts` — `cn()`: combina clases y resuelve conflictos de Tailwind (usado por shadcn/ui).

## Contenido previsto

- `supabase.ts` — cliente Supabase (singleton). [A3]
- `database.types.ts` — tipos GENERADOS desde el esquema (no editar a mano). [A2]
- `money.ts` — consolidación multi-moneda (pura, testeada). [C11]
- `billing.ts` — ciclo de cierre / período (pura, testeada). [C11]
- `format.ts` — formato de moneda/fecha por locale. [C11]
