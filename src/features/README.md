# src/features

Un módulo por dominio (vertical slice). Cada feature: `api.ts` (habla con Supabase, sin React)
+ `hooks.ts` (react-query) + `schema.ts` (zod) + `components/`, y su propio `README.md` que
lista las funcionalidades / FR del PRD que implementa. (Vacío hasta Sprint A/B.)

## Dominios previstos

- `auth/` — login/registro, sesión. (hecho — A3)
- `workspaces/` — pertenencia + onboarding (hecho — A4); workspace activo (A5); invitaciones (C15).
- `accounts/` — tarjetas/medios + extensiones. (hecho — B7)
- `categories/` — categorías (seed + CRUD). (hecho — B6)
- `transactions/` — alta/edición (hecho — B8); lista + filtros + búsqueda (hecho — B10); OCR de comprobantes (F2-2).
- `imports/` — importar resúmenes de tarjeta (PDF) → revisión → alta en bloque (FR-16, F2-3).
- `reports/` — tabs y gráficos. (hecho — C13)
