# Cuentas Claras

App web para registrar **ingresos y gastos mensuales**, individual o en grupo, multi-moneda. Registra **quién gastó, qué, con qué medio, cuándo y cuánto**, y lo muestra por mes, persona, tarjeta, banco, red y categoría.

> Estado: **diseño completo, pre-desarrollo.** Toda la documentación está lista; falta empezar a programar la Fase 1.

## Documentación

| Documento | Para qué |
|-----------|----------|
| [`GETTING_STARTED.md`](./GETTING_STARTED.md) | Cómo retomar el proyecto en otra máquina y trabajar el backlog con Claude Code (con prompt de arranque). |
| [`PRD.md`](./PRD.md) | Producto: requisitos, casos de uso, modelo de datos conceptual, roadmap. |
| [`PLAN_TECNICO_FASE1.md`](./PLAN_TECNICO_FASE1.md) | Stack, estructura del repo, capa de datos, mapeo pantallas→componentes, escalabilidad. |
| [`db/schema_fase1.sql`](./db/schema_fase1.sql) | Esquema real (Postgres/Supabase) con RLS. |
| [`wireframes/wireframes_fase1.html`](./wireframes/wireframes_fase1.html) | Wireframes de las 8 pantallas del MVP (abrir en el navegador). |
| [`tasks/`](./tasks/) | Backlog: un archivo por ticket. Empezar por [`tasks/README.md`](./tasks/README.md). |
| [`CLAUDE.md`](./CLAUDE.md) | Contexto y reglas para agentes de Claude Code (incluye política de modelos). |

## Estructura de carpetas

| Carpeta | Contenido |
|---------|-----------|
| `db/` | Esquema SQL de la base (Postgres/Supabase) — fuente de verdad del modelo de datos. |
| `wireframes/` | Wireframes de baja fidelidad de las 8 pantallas del MVP (HTML). |
| `tasks/` | Backlog: un archivo por ticket + `README.md` con el orden y las dependencias. |
| `scripts/` | Automatización: runner headless que corre cada ticket con el modelo correcto y commitea. |
| `src/` | Código de la app (se crea en el ticket A1): `app/`, `lib/`, `features/`, `components/`, `hooks/`, `types/`. |
| `supabase/` | Migraciones (`migrations/`) y edge functions (`functions/`) — se crean en A2/C12. |

Cada carpeta significativa tiene su propio `README.md` describiendo qué hay adentro (ver convención abajo).

### Convención: índice por carpeta

- Cada carpeta significativa lleva un `README.md` que describe **qué es y qué contiene** (archivo por archivo, en una línea).
- Al **crear o borrar** un archivo en una carpeta, se actualiza el `README.md` de esa carpeta en el mismo cambio.
- Una feature nueva en `src/features/<dominio>/` lleva un `README.md` con: propósito, archivos (`api.ts`/`hooks.ts`/`schema.ts`/`components/`) y **las funcionalidades / requisitos del PRD que implementa**.
- No aplica a carpetas triviales o autogeneradas (`node_modules`, `dist`, etc.).

## Stack

Vite + React 18 + TypeScript (strict) · Supabase (Postgres + Auth + Storage + RLS) · TanStack Query · Zustand · react-router-dom · Tailwind + shadcn/ui · react-hook-form + zod · Recharts · date-fns · Vitest.

## Cómo empezar (cuando exista código — ticket A1)

```bash
npm install
cp .env.example .env        # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev                 # Vite
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm test                    # vitest
```

> Hasta completar el ticket **A1 (scaffolding)** estos comandos aún no existen. El backlog y el orden de trabajo están en [`tasks/README.md`](./tasks/README.md).

## Flujo de trabajo

1. Leer `tasks/README.md` y elegir el ticket de menor número con dependencias listas.
2. Pasarle **un solo ticket** a un agente/subagente.
3. Al terminar: `typecheck`, `lint`, `test` y revisión contra los criterios de aceptación.

## Seguridad

La autorización la garantiza **RLS** en la base de datos (aislamiento por workspace). La `anon key` es pública por diseño; **nunca** commitear la `service_role` key ni archivos `.env`.
