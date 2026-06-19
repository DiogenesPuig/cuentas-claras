# src/components

UI reutilizable y transversal.

## Carpetas

- `ui/` — componentes de shadcn/ui (copiados con `npx shadcn@latest add <comp>`).
  No se editan a mano salvo necesidad; quedan fuera del lint (ver `.eslintrc.cjs`).

## Archivos

- `WorkspaceSwitcher.tsx` — selector del workspace activo (usa `useActiveWorkspace`).
- `MonthSwitcher.tsx` — navegación del período/mes activo (usa `useActiveMonth`).
