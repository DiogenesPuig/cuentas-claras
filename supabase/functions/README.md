# supabase/functions/ — Edge functions (Deno)

Funciones serverless que corren en el runtime Deno de Supabase (no en el bundle
del front). Se despliegan con `supabase functions deploy <nombre>`.

## Contenido

- `fx-refresh/` — cachea diariamente las cotizaciones de dolarapi en `fx_rates` y
  hace de keep-alive del proyecto (C12). Ver su `README.md` para el contrato.

## Notas de tooling

- No las cubre `npm run typecheck` (el `tsconfig` del proyecto solo incluye `src/`).
- `npm run lint` sí las lintea: `.eslintrc.cjs` tiene un override que expone el
  global `Deno` para esa carpeta.
- La lógica pura de cada función vive en archivos sin imports de Deno (ej.
  `parse.ts`) para poder testearla con vitest.
