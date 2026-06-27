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

## Regla: portabilidad / no encerrarse en Supabase

> Objetivo: que un día se pueda mover el proyecto a backend propio + Postgres pelado (u otra nube) **sin reescribir media app**. No migramos ahora, pero todo lo nuevo debe respetar estas fronteras para que el costo de esa mudanza no crezca ticket a ticket.

- **`api.ts` es la ÚNICA capa que toca Supabase.** Ningún `hooks.ts`, componente, `lib/` ni `schema.ts` importa `supabase` ni `database.types`. Si mañana hay backend propio, se reescribe solo `api.ts` (por feature) y el resto queda intacto. Si te tienta llamar a `supabase` desde un hook o componente, **parálo y movelo a `api.ts`**.
- **La lógica de negocio vive en `lib/` (pura, testeada, sin red ni Supabase).** Dinero, ciclos, parseos, formato. Es lo más caro de reescribir, así que tiene que ser 100% portable (ej. `lib/money.ts`, `lib/billing.ts`, y la lógica pura de las edge functions en archivos sin imports de Deno como `parse.ts`).
- **Edge functions: cascarón fino.** El `index.ts` (runtime Deno + env de Supabase) solo orquesta; toda la lógica real va en un módulo puro al lado, importable desde vitest. Migrar = reescribir el cascarón, no la lógica.
- **Acoplamientos conocidos a Supabase** (a reemplazar el día de la mudanza, NO antes): Auth (`auth.uid()`, `auth.users`), Storage (`storage.objects`), cron+secrets (`pg_cron`/`pg_net`/Vault en migraciones), y la API autogenerada (PostgREST) que hoy consume `supabase-js`. No agregar acoplamientos nuevos fuera de `api.ts` / migraciones.
- **RLS sigue siendo la fuente de verdad de seguridad** (no debilitarla por "portabilidad"). Es portable a cualquier Postgres; lo que cambiaría es cómo se inyecta la identidad del usuario en la sesión.
- Ante la duda de si algo "ata" más el proyecto a Supabase de lo necesario, **escalá la decisión** (ver "Política de modelos") en vez de improvisar.

## Convención: índice por carpeta (mantener actualizado)

- Cada carpeta significativa tiene un `README.md` que describe **qué es y qué contiene**, archivo por archivo (una línea por archivo).
- Al **crear o borrar** un archivo en una carpeta, actualizá el `README.md` de esa carpeta **en el mismo cambio** (es parte de la Definition of Done).
- Para una feature en `src/features/<dominio>/`, su `README.md` lista: propósito, archivos (`api.ts`/`hooks.ts`/`schema.ts`/`components/`) y **las funcionalidades / requisitos del PRD (FR-…) que implementa**.
- No aplica a carpetas triviales o autogeneradas (`node_modules`, `dist`, `coverage`, etc.).

## Comandos (rellenar al hacer scaffolding — ticket A1)

```
npm install
npm run dev         # Vite (http://localhost:5173)
npm run build       # tsc --noEmit && vite build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (--max-warnings 0)
npm run format      # prettier --write
npm test            # vitest run  (npm run test:watch para modo watch)
```

## Definición de "hecho" (Definition of Done)

- Compila sin errores (`typecheck`) y pasa `lint`.
- Si el ticket toca lógica pura (`lib/`), tiene tests que pasan.
- Cumple los **criterios de aceptación** del ticket.
- No mete cambios fuera del alcance del ticket.
- No agrega dependencias nuevas salvo que el ticket lo indique.
- Si crea o borra archivos en una carpeta, el `README.md` de esa carpeta queda actualizado (ver "Convención: índice por carpeta").
- **Si el ticket necesitó migraciones de DB, quedan aplicadas en el proyecto remoto** (`supabase db push`, verificado con `supabase migration list --linked`) y los tipos regenerados si el esquema cambió. Una migración escrita pero sin aplicar **no** cierra el ticket: el feature no funciona en producción hasta que corre.

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
2. Crear (o pararse sobre) una rama `task/<id-en-minúscula>` (ej. `task/b7`) **antes** de tocar código del ticket. No trabajar tickets directamente sobre `main`.
3. (Opus) revisar el ticket y, si hace falta, afinarlo.
4. (Sonnet/Haiku) implementar **solo ese ticket**.
5. Correr `typecheck`, `lint`, `test`. Si está instalado el hook de `claude-setup/`, el gate lo fuerza al cerrar el turno.
6. Revisar el diff contra los criterios de aceptación antes de mergear. Para tickets de riesgo (auth, RLS, dinero, FX, permisos) usar el subagente `reviewer` (ver `claude-setup/README.md`).
7. Push de la rama + **abrir PR**. CI corre `typecheck`/`lint`/`test`/`build` + el check de Vercel.
8. **Esperar a que el usuario lo pruebe en local antes de mergear** (regla 2026-06-27): el agente NO mergea hasta que el usuario corre el cambio en local y confirma que está OK. Excepción: cambios solo-docs/backlog (bajo riesgo) se pueden mergear sin prueba local.
9. Mergear el PR a `main`. Vercel deploya producción solo (desde el repo `cuentas-claras`); los fixes de **DB** (migraciones aplicadas con `supabase db push`) ya quedan vivos sin depender del deploy del front, y el **micro de ingesta** (OCR/resúmenes) se actualiza aparte subiéndolo al Space de Hugging Face.
10. Si el ticket está completo, mover su archivo a `tasks/done/` y actualizar `tasks/README.md`.
