# src/features

Un módulo por dominio (vertical slice). Cada feature: `api.ts` (habla con Supabase, sin React)
+ `hooks.ts` (react-query) + `schema.ts` (zod) + `components/`, y su propio `README.md` que
lista las funcionalidades / FR del PRD que implementa. (Vacío hasta Sprint A/B.)

## Dominios previstos

- `auth/` — login/registro, sesión. (hecho — A3)
- `workspaces/` — workspace activo, miembros, invitaciones. [A4/A5/C15]
- `accounts/` — tarjetas/medios + extensiones. [B7]
- `categories/` — categorías (seed + CRUD). [B6]
- `transactions/` — alta/edición, lista, filtros. [B8/B10]
- `reports/` — tabs y gráficos. [C13]
