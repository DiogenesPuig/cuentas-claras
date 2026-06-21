# src/components

UI reutilizable y transversal.

## Carpetas

- `ui/` — componentes de shadcn/ui (copiados con `npx shadcn@latest add <comp>`).
  No se editan a mano salvo necesidad; quedan fuera del lint (ver `eslint.config.js`).

## Archivos

- `WorkspaceSwitcher.tsx` — selector del workspace activo (usa `useActiveWorkspace`).
- `MonthSwitcher.tsx` — navegación del período/mes activo (usa `useActiveMonth`).
- `Fab.tsx` — botón flotante de acción principal (usado en `DashboardPage` para abrir el alta
  rápida de movimientos, B9).
