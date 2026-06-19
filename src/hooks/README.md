# src/hooks

Hooks transversales (no atados a un solo dominio).

## Archivos

- `useActiveWorkspace.ts` — store (Zustand) del workspace activo, persistido en localStorage.
- `useActiveWorkspace.test.ts` — tests del store (set/clear + persistencia).
- `useActiveMonth.ts` — store (Zustand) del período/mes activo + helpers (`shiftMonth`, `formatMonthLabel`).
- `useActiveMonth.test.ts` — tests de los helpers de mes.
