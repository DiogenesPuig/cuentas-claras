# src

Código de la app (Vite + React + TS strict). Mobile-first.

## Archivos

- `main.tsx` — punto de entrada: monta `<App/>` en `#root` y carga `index.css`.
- `App.tsx` — componente raíz. Por ahora pantalla mínima (placeholder del MVP).
- `App.test.tsx` — smoke test de `App` (Testing Library + Vitest).
- `index.css` — directivas de Tailwind + variables de tema de shadcn/ui (light/dark).
- `vite-env.d.ts` — tipos de `import.meta.env` de Vite.

## Carpetas

- `app/` — router, providers y layout/navegación.
- `lib/` — utilidades puras y clientes (supabase, money, billing, format, utils).
- `features/` — un módulo por dominio (vertical slices): `api.ts` + `hooks.ts` + `schema.ts` + `components/`.
- `components/` — UI reutilizable (shadcn/ui en `components/ui` + propios).
- `hooks/` — hooks transversales.
- `types/` — tipos de dominio (alias sobre `lib/database.types.ts`).
- `test/` — setup de Vitest/Testing Library.
