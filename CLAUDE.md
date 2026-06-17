# CLAUDE.md — Cuentas Claras

Contexto del proyecto para agentes de Claude Code. **Leé esto antes de tocar código.**

## Qué es

App web para registrar **ingresos y gastos mensuales**, individual o en grupo, multi-moneda. Registra **quién gastó, qué, con qué medio, cuándo y cuánto**, y lo muestra por mes, persona, tarjeta, banco, red y categoría. Fases posteriores: OCR de comprobantes, parseo de resúmenes de tarjeta, bot de WhatsApp y "quién le debe a quién".

## Documentos de referencia (fuente de verdad)

- `PRD.md` — producto, requisitos, casos de uso, modelo de datos conceptual, roadmap.
- `db/schema_fase1.sql` — **esquema real** (Postgres/Supabase) con RLS. Si cambia el esquema, regenerar tipos.
- `PLAN_TECNICO_FASE1.md` — stack, estructura del repo, capa de datos, mapeo pantallas→componentes.
- `wireframes/wireframes_fase1.html` — wireframes de las 8 pantallas del MVP.
- `tasks/` — backlog: **un archivo por ticket**. Empezá por `tasks/README.md`.

Ante cualquier duda de alcance o diseño, estos documentos mandan sobre suposiciones.

## Stack

Vite + React 18 + **TypeScript (strict)** · Supabase (Postgres + Auth + Storage + **RLS**) · TanStack Query · Zustand (mínimo) · react-router-dom · Tailwind + shadcn/ui · react-hook-form + zod · Recharts · date-fns · Vitest + Testing Library.

No agregar dependencias fuera de esta lista sin justificarlo y escalar la decisión (ver "Política de modelos").

## Estructura

```
src/
  app/        router, providers, layout
  lib/        supabase, database.types (GENERADO), money, billing, format
  features/   un módulo por dominio (auth, workspaces, accounts, categories, transactions, reports)
  components/ UI reutilizable
  hooks/      hooks transversales
  types/      tipos de dominio (alias sobre database.types)
supabase/     migrations/, functions/fx-refresh/
```

Cada feature: `api.ts` (habla con Supabase, sin React) · `hooks.ts` (react-query) · `schema.ts` (zod) · `components/`.

## Reglas de código (Clean Code)

- `strict: true`. Nada de `any` sin comentario que lo justifique.
- Código en inglés; textos de UI en español (preparado para i18n).
- `api.ts` no importa React; los hooks no arman SQL crudo; el JSX no tiene lógica de datos.
- Componentes chicos, una responsabilidad. Lógica pura en `lib/` y testeada.
- La **seguridad la garantiza RLS** en la DB. El front filtra por `workspace_id` por claridad, pero nunca confía solo en eso.
- Nunca exponer la `service_role` key en el front. La `anon key` es pública por diseño.
- Tipos de la DB: **no editar `database.types.ts` a mano**; se regenera con `supabase gen types`.

## Convención: índice por carpeta (mantener actualizado)

- Cada carpeta significativa tiene un `README.md` que describe **qué es y qué contiene**, archivo por archivo (una línea por archivo).
- Al **crear o borrar** un archivo en una carpeta, actualizá el `README.md` de esa carpeta **en el mismo cambio** (es parte de la Definition of Done).
- Para una feature en `src/features/<dominio>/`, su `README.md` lista: propósito, archivos (`api.ts`/`hooks.ts`/`schema.ts`/`components/`) y **las funcionalidades / requisitos del PRD (FR-…) que implementa**.
- No aplica a carpetas triviales o autogeneradas (`node_modules`, `dist`, `coverage`, etc.).

## Comandos (rellenar al hacer scaffolding — ticket A1)

```
npm install
npm run dev         # Vite
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
```

## Definición de "hecho" (Definition of Done)

- Compila sin errores (`typecheck`) y pasa `lint`.
- Si el ticket toca lógica pura (`lib/`), tiene tests que pasan.
- Cumple los **criterios de aceptación** del ticket.
- No mete cambios fuera del alcance del ticket.
- No agrega dependencias nuevas salvo que el ticket lo indique.
- Si crea o borra archivos en una carpeta, el `README.md` de esa carpeta queda actualizado (ver "Convención: índice por carpeta").

## Política de modelos (editable — cambiá esto si querés)

> El objetivo es minimizar costo: que el modelo caro decida y revise, y los modelos baratos ejecuten tareas ya definidas.

| Modelo | Rol | Cuándo usarlo |
|--------|-----|---------------|
| **Opus** (top) | Arquitecto / orquestador / revisor | Decisiones de diseño, definir o reescribir tickets, elegir/aprobar dependencias, cambios de esquema, resolver ambigüedad, **revisar PRs**. |
| **Sonnet** (medio) | Implementador por defecto | Ejecutar tickets bien definidos: componentes, hooks, queries, formularios, lógica con tests. Es el caballo de batalla. |
| **Haiku** (barato) | Tareas mecánicas | Boilerplate, scaffolding repetitivo, renombres, tests triviales a partir de specs claras, formateo. Solo cuando NO hay decisiones que tomar. |

**Por qué este reparto:** las decisiones de diseño son baratas de tomar pero caras de revertir, así que conviene el mejor modelo; la implementación de un ticket bien especificado es trabajo acotado donde Sonnet rinde casi igual que Opus a una fracción del costo; lo puramente mecánico no necesita razonamiento y Haiku alcanza.

**Regla de escalado (importante):** si durante un ticket de implementación aparece una decisión NO resuelta (nueva dependencia, cambio de esquema, patrón nuevo, ambigüedad en los criterios), el agente **se detiene y escala a Opus** (o deja una nota `// DECISIÓN PENDIENTE: ...` y no improvisa). Cada ticket trae un campo "Modelo sugerido"; es una recomendación, no una obligación.

## Flujo sugerido en Claude Code

1. Abrir `tasks/README.md` y elegir el próximo ticket según dependencias.
2. (Opus) revisar el ticket y, si hace falta, afinarlo.
3. (Sonnet/Haiku) implementar **solo ese ticket**.
4. Correr `typecheck`, `lint`, `test`.
5. (Opus) revisar el diff contra los criterios de aceptación antes de mergear.
