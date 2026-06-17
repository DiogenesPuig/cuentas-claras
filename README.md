# Cuentas Claras

App web para registrar **ingresos y gastos mensuales**, individual o en grupo, multi-moneda. Registra **quién gastó, qué, con qué medio, cuándo y cuánto**, y lo muestra por mes, persona, tarjeta, banco, red y categoría.

> Estado: **diseño completo, pre-desarrollo.** Toda la documentación está lista; falta empezar a programar la Fase 1.

## Documentación

| Documento | Para qué |
|-----------|----------|
| [`PRD.md`](./PRD.md) | Producto: requisitos, casos de uso, modelo de datos conceptual, roadmap. |
| [`PLAN_TECNICO_FASE1.md`](./PLAN_TECNICO_FASE1.md) | Stack, estructura del repo, capa de datos, mapeo pantallas→componentes, escalabilidad. |
| [`db/schema_fase1.sql`](./db/schema_fase1.sql) | Esquema real (Postgres/Supabase) con RLS. |
| [`wireframes/wireframes_fase1.html`](./wireframes/wireframes_fase1.html) | Wireframes de las 8 pantallas del MVP (abrir en el navegador). |
| [`tasks/`](./tasks/) | Backlog: un archivo por ticket. Empezar por [`tasks/README.md`](./tasks/README.md). |
| [`CLAUDE.md`](./CLAUDE.md) | Contexto y reglas para agentes de Claude Code (incluye política de modelos). |

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
