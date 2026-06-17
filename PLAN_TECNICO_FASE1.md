# Plan técnico — Cuentas Claras (Fase 1 / MVP)

**Versión:** 1.0 · **Fecha:** 2026-06-17
**Alcance:** implementación de la Fase 1 del PRD (registro de movimientos, tarjetas/medios, categorías, reportes y grupos). No incluye OCR, parseo de resúmenes, WhatsApp ni saldos.

Este documento baja el PRD y el esquema (`db/schema_fase1.sql`) a algo construible: stack, estructura del repo, tipos, capa de datos, componentes por pantalla y orden de trabajo.

---

## 1. Stack y decisiones

| Capa | Elección | Por qué |
|------|----------|---------|
| Build/dev | **Vite** + React 18 + **TypeScript** | Arranque rápido, HMR, cero config pesada. |
| Backend | **Supabase** (Postgres + Auth + Storage + RLS) | Lo decidido en el PRD. La seguridad por workspace ya vive en la DB (RLS), el front no la reimplementa. |
| Datos/servidor | **@tanstack/react-query** | Caché, reintentos, estados de carga/error y revalidación. Evita un store global para datos remotos. |
| Estado UI | **Zustand** (mínimo) + Context | Solo para estado local transversal (workspace activo, modales). Sin Redux: es overkill para este tamaño. |
| Routing | **react-router-dom** | Estándar, suficiente. |
| Estilos | **Tailwind CSS** + **shadcn/ui** | Rápido, consistente y accesible. Componentes copiables, sin lock-in. |
| Formularios | **react-hook-form** + **zod** | Menos boilerplate y validación tipada. `zod` se reutiliza para validar entradas y (más adelante) imports. |
| Gráficos | **Recharts** | Simple para torta/barras de los reportes. |
| Fechas | **date-fns** | Liviano y tree-shakeable (vs. moment). Necesario para ciclos de cierre. |
| Tests | **Vitest** + **@testing-library/react** | Mismo runner que Vite; foco en lógica de negocio. |
| Calidad | **ESLint** + **Prettier** | Clean Code, formato consistente. |

**Principio rector:** no sumar librerías que no paguen su costo. Todo lo de arriba cubre una necesidad concreta del MVP; cualquier otra dependencia debe justificarse en el PR.

---

## 2. Estructura del repositorio

```
cuentas-claras/
├─ db/
│  └─ schema_fase1.sql            # fuente de verdad del esquema (ya existe)
├─ supabase/
│  ├─ migrations/                 # migraciones versionadas (supabase CLI)
│  └─ functions/
│     └─ fx-refresh/              # edge function: cachea tipo de cambio (+ keep-alive)
├─ src/
│  ├─ app/
│  │  ├─ router.tsx               # definición de rutas
│  │  ├─ providers.tsx            # QueryClient, Auth, Workspace, Theme
│  │  └─ layout/                  # AppLayout, TabBar, Header
│  ├─ lib/
│  │  ├─ supabase.ts              # cliente Supabase (singleton)
│  │  ├─ database.types.ts        # tipos GENERADOS desde el esquema (no editar a mano)
│  │  ├─ money.ts                 # consolidación multi-moneda
│  │  ├─ billing.ts               # lógica de ciclo de cierre / período
│  │  └─ format.ts                # formato de moneda/fecha por locale
│  ├─ features/                   # un módulo por dominio (vertical slices)
│  │  ├─ auth/
│  │  ├─ workspaces/
│  │  ├─ accounts/                # tarjetas/medios + extensiones
│  │  ├─ categories/
│  │  ├─ transactions/
│  │  └─ reports/
│  ├─ components/                 # UI reutilizable (shadcn + propios)
│  ├─ hooks/                      # hooks transversales
│  └─ types/                      # tipos de dominio (mapean al esquema)
├─ .env.local                     # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├─ .eslintrc.cjs · .prettierrc · tsconfig.json
└─ vite.config.ts
```

**Por qué "features" (vertical slices):** cada pantalla del MVP es un dominio con sus hooks, componentes y tipos juntos. Es más fácil de navegar y de borrar/mover que separar por tipo técnico (todos los hooks en una carpeta, etc.).

Cada feature sigue el patrón:

```
features/transactions/
├─ api.ts            # queries y mutations (react-query) contra Supabase
├─ schema.ts         # zod schemas + tipos inferidos
├─ components/       # TransactionList, TransactionForm, TransactionRow...
├─ hooks.ts          # useTransactions, useCreateTransaction...
└─ index.ts
```

---

## 3. Configuración de Supabase y generación de tipos

**Cliente** (`src/lib/supabase.ts`):

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

**Tipos generados desde el esquema** (no se escriben a mano):

```bash
# una vez logueado y linkeado el proyecto:
supabase gen types typescript --linked > src/lib/database.types.ts
```

Esto produce `Database['public']['Tables']['transactions']['Row' | 'Insert' | 'Update']`, etc. Cada cambio en el esquema regenera el archivo → los tipos del front nunca quedan desfasados de la DB.

**Migraciones:** el `schema_fase1.sql` se parte en migraciones dentro de `supabase/migrations/` para versionarlas y poder aplicarlas con `supabase db push`.

---

## 4. Tipos de dominio

Sobre los tipos generados, definimos alias de dominio legibles (`src/types/`):

```ts
import type { Database } from '@/lib/database.types';

type T = Database['public']['Tables'];

export type Workspace   = T['workspaces']['Row'];
export type Member      = T['workspace_members']['Row'];
export type Account     = T['accounts']['Row'];        // incl. is_extension, parent_account_id, network, holder_name
export type Category    = T['categories']['Row'];
export type Transaction = T['transactions']['Row'];
export type Attachment  = T['attachments']['Row'];

export type NewTransaction = T['transactions']['Insert'];
export type Money = { amount: number; currency: string };
```

Tipos derivados/vista para la UI (lo que cada pantalla necesita "ya armado"):

```ts
// Movimiento enriquecido para listas/reportes
export interface TransactionView extends Transaction {
  account?: Pick<Account, 'name' | 'bank' | 'network' | 'is_extension' | 'holder_name'>;
  category?: Pick<Category, 'name' | 'icon'>;
  personName: string;     // holder del medio (owner member o holder_name)
}
```

---

## 5. Capa de datos (react-query sobre Supabase)

Patrón único por entidad: funciones `api.ts` "tontas" (hablan con Supabase) + hooks que las envuelven en react-query.

```ts
// features/transactions/api.ts
import { supabase } from '@/lib/supabase';
import type { NewTransaction } from '@/types';

export async function listTransactions(workspaceId: string, filters: TxFilters) {
  let q = supabase
    .from('transactions')
    .select('*, account:accounts(name,bank,network,is_extension,holder_name), category:categories(name,icon)')
    .eq('workspace_id', workspaceId)
    .order('occurred_on', { ascending: false });

  if (filters.from)     q = q.gte('charged_on', filters.from);
  if (filters.to)       q = q.lte('charged_on', filters.to);
  if (filters.accountId)q = q.eq('account_id', filters.accountId);
  if (filters.categoryId) q = q.eq('category_id', filters.categoryId);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createTransaction(input: NewTransaction) {
  const { data, error } = await supabase.from('transactions').insert(input).select().single();
  if (error) throw error;
  return data;
}
```

```ts
// features/transactions/hooks.ts
export function useTransactions(filters: TxFilters) {
  const { workspaceId } = useActiveWorkspace();
  return useQuery({
    queryKey: ['transactions', workspaceId, filters],
    queryFn: () => listTransactions(workspaceId, filters),
    enabled: !!workspaceId,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  const { workspaceId } = useActiveWorkspace();
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', workspaceId] }),
  });
}
```

**Nota sobre seguridad:** las queries filtran por `workspace_id`, pero la garantía real la da **RLS** en la DB. Aunque el front omita el filtro, Postgres no devuelve filas de otros workspaces.

---

## 6. Mapeo wireframe → rutas y componentes

| # Wireframe | Ruta | Componentes clave |
|-------------|------|-------------------|
| 1 Ingreso/registro | `/login`, `/register` | `AuthForm`, `OAuthButton` |
| 2 Dashboard | `/` | `MonthSwitcher`, `WorkspaceSwitcher`, `SummaryCard`, `RecentTransactions`, `Fab` |
| 3 Alta rápida | modal | `TransactionForm` (type, amount+currency, motivo, categoría, medio, fecha, se-cobra, adjunto) |
| 4 Movimientos | `/movimientos` | `SearchBar`, `FilterBar`, `TransactionList`, `ExportButton` |
| 5 Tarjetas/medios | `/medios` | `AccountList` (filas planas), `AccountForm` (banco, red, tipo, holder, is_extension, parent, cierre) |
| 6 Reportes | `/reportes` | `ReportTabs` (categoría/persona/banco/red/medio), `DonutChart`, `BarChart` |
| 7 Grupo/miembros | `/grupo` | `MemberList`, `RoleSelect`, `InviteButton` |
| 8 Invitar | modal | `InviteForm`, `InviteLink` |

Layout: `AppLayout` con `Header` (workspace + mes), `TabBar` inferior (Inicio/Movim./Reportes/Ajustes) y `<Outlet/>`. Mobile-first; en desktop el TabBar pasa a sidebar.

---

## 7. Auth y workspace activo

- **Auth:** `supabase.auth` (email/password + OAuth Google). Un `AuthProvider` expone `session` y `user`; un `<RequireAuth>` envuelve las rutas privadas y redirige a `/login`.
- **Perfil:** al primer login, si no existe fila en `profiles`, se crea (nombre del proveedor). 
- **Workspace activo:** `WorkspaceProvider` (Zustand) guarda el `workspaceId` actual y lo persiste en `localStorage`. Todos los hooks de datos lo leen vía `useActiveWorkspace()`. Si el usuario no tiene workspaces, se lo lleva al onboarding (`crear primer grupo`).

```ts
// hooks/useActiveWorkspace.ts
export const useActiveWorkspace = create<{workspaceId?: string; setWorkspace:(id:string)=>void}>(
  (set) => ({
    workspaceId: localStorage.getItem('ws') ?? undefined,
    setWorkspace: (id) => { localStorage.setItem('ws', id); set({ workspaceId: id }); },
  }),
);
```

---

## 8. Multi-moneda y job de tipo de cambio

- **Cálculo consolidado** (`src/lib/money.ts`): función pura, fácil de testear.

```ts
// Convierte y suma a la moneda base usando un mapa de cotizaciones.
export function consolidate(
  txs: { amount: number; currency: string; type: 'income'|'expense' }[],
  base: string,
  rates: Record<string, number>,          // ej. { USD: 1100 } expresado en base por unidad
): { income: number; expense: number; balance: number; byCurrency: Record<string, number> } {
  // ...suma por moneda y total en base = monto*rate (o monto si ya es base)
}
```

- **Cotizaciones:** una **edge function** `fx-refresh` consulta dolarapi/BCRA una vez por día y guarda en una tabla `fx_rates (date, source, quote, currency, rate)` (a agregar en la migración de FX). El front lee la cotización elegida por el workspace (`fx_source`/`fx_quote`).
- **Keep-alive:** el cron diario de `fx-refresh` escribe en la DB → mantiene el proyecto Supabase activo (ver PRD §15). Un solo mecanismo cubre FX + anti-pausa.
- **FX a fecha de cobro:** el consolidado usa la cotización de `charged_on` (no de la compra), según lo definido.

- **Ciclo de cierre** (`src/lib/billing.ts`): dada una tarjeta con `billing_close_day`, calcular el rango del "período" y a qué ciclo cae un `charged_on`. Función pura y testeada.

---

## 9. Validación (zod)

Cada formulario valida con un schema reutilizable:

```ts
// features/transactions/schema.ts
export const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  currency: z.string().length(3),
  description: z.string().max(140).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  occurredOn: z.coerce.date(),
  chargedOn: z.coerce.date().optional(),
});
export type TransactionInput = z.infer<typeof transactionSchema>;
```

---

## 10. Testing

Foco en **lógica de negocio pura** (alto valor, bajo costo):

- `money.consolidate` — sumas por moneda, conversión, balance.
- `billing` — a qué ciclo cae una fecha según día de cierre (incluye fin de mes / día 31).
- `format` — moneda/fecha por locale.
- Smoke test de `TransactionForm` (validación con zod) con Testing Library.

No se testea contra Supabase real en unit tests; se mockea `api.ts`. (Opcional fase posterior: tests e2e con Playwright sobre un proyecto Supabase de staging.)

---

## 11. Convenciones (Clean Code) y CI

- TypeScript `strict: true`. Sin `any` salvo justificación.
- Nombres en inglés en el código, textos de UI en español (preparado para i18n).
- Componentes chicos y con una responsabilidad; lógica de datos en hooks, no en JSX.
- `api.ts` no conoce React; los hooks no arman SQL.
- ESLint + Prettier en pre-commit (husky + lint-staged). 
- CI (GitHub Actions): `typecheck` + `lint` + `test` en cada PR. (Ese workflow también puede alojar el keep-alive si no se usa la edge function.)

---

## 12. Orden de implementación (tickets de Fase 1)

> Secuencia pensada para tener algo usable lo antes posible y reducir bloqueos.

**Sprint A — Cimientos**
1. Scaffolding Vite + TS + Tailwind + ESLint/Prettier + estructura de carpetas.
2. Aplicar `schema_fase1.sql` como migraciones en Supabase; generar `database.types.ts`.
3. Cliente Supabase + AuthProvider + login/registro + `<RequireAuth>`.
4. Alta de perfil y onboarding: crear primer workspace (trigger ya agrega owner).
5. `WorkspaceProvider` + `WorkspaceSwitcher` + AppLayout/TabBar.

**Sprint B — Núcleo de registro**
6. Categorías (seed global + CRUD propias).
7. Medios/tarjetas: `AccountList` (plano) + `AccountForm` (banco, red, tipo, holder, extensión, cierre).
8. `TransactionForm` (alta/edición) + `useCreateTransaction`.
9. Dashboard: `SummaryCard` + `RecentTransactions` + `MonthSwitcher` + FAB.
10. Movimientos: lista + filtros + búsqueda + editar/eliminar (según permisos).

**Sprint C — Visualización y grupo**
11. `money.consolidate` + `billing` (con tests) e integración del consolidado multi-moneda.
12. Edge function `fx-refresh` + tabla `fx_rates` + cron (keep-alive).
13. Reportes: tabs (categoría/persona/banco/red/medio) con Recharts.
14. Export CSV/XLSX del período filtrado.
15. Grupo: miembros, roles, invitaciones (email + link).

**Criterio de salida de Fase 1:** un grupo puede registrar ingresos/gastos en varias monedas, verlos por mes/persona/tarjeta/categoría con consolidado en moneda base, gestionar medios (incl. extensiones) y miembros, y exportar.

---

## 13. Variables de entorno

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# Edge function fx-refresh (server-side):
FX_PRIMARY_SOURCE=dolarapi
```

`anon key` es pública por diseño (el acceso real lo controla RLS). Nunca exponer la `service_role` key en el front.

---

## 14. Decisiones de arquitectura y escalabilidad

Esta sección explica **por qué la estructura aguanta el crecimiento** y deja **disparadores concretos** ("cuando pase X, hacé Y") para evolucionarla sin reescribir. Sirve de guía para humanos y agentes: ningún punto de abajo requiere reestructurar lo de Fase 1; son cambios *aditivos*.

### 14.1 Qué la hace escalable (decisiones deliberadas)

- **Features por vertical slice.** Cada dominio nuevo del roadmap (OCR, parseo de resúmenes, WhatsApp, saldos) entra como una carpeta en `features/` sin tocar las existentes. Se crece por agregado, no por cirugía.
- **Patrón uniforme `api.ts` + `hooks.ts` + `schema.ts`.** Sumar un dominio es mecánico y predecible (apto para subagentes baratos).
- **Multi-tenancy con `workspace_id` + RLS.** Patrón estándar de SaaS; escala horizontalmente por mucho tiempo. La seguridad vive en la DB, no en el front.
- **Tipos generados desde la DB.** El esquema puede crecer sin desincronizar front/back.
- **Lo pesado y lo divergente, desacoplado.** OCR/parseo → microservicio Python; notificaciones/WhatsApp → servicios aparte; FX → edge function. La web app no carga con eso.
- **Lógica de negocio en `lib/` (pura y testeada).** Es el "seguro de vida": el día que se cambie de backend, se migran datos (Postgres estándar) sin reescribir el dominio.
- **Camino de salida del BaaS documentado.** Supabase para arrancar → +microservicio Python (Fase 2) → core en Node/NestJS si la lógica se vuelve muy custom. No hay lock-in duro.

### 14.2 Disparadores de evolución (cuándo y qué cambiar)

| Disparador (síntoma) | Acción | Impacto |
|----------------------|--------|---------|
| Reportes lentos con muchos movimientos | Mover agregaciones de `api.ts`/cliente a **SQL** (vistas, funciones RPC o vistas materializadas) | Aditivo: nuevas funciones DB + ajuste de `reports/api.ts` |
| Hace falta más que un cron diario (OCR en lote, reprocesos) | Introducir una **cola de jobs** + worker dedicado | Nuevo servicio; no toca la web |
| Aterriza el microservicio Python junto a web + functions | Pasar a **monorepo** (pnpm workspaces / Turborepo) | Reubicación de carpetas, sin reescritura |
| Muchas conexiones concurrentes | Usar el **pooler de Supabase (PgBouncer)** | Config de infra |
| Lógica de negocio cada vez más custom / reglas complejas | Migrar el core a **backend propio (NestJS)**, manteniendo Postgres | Medio: se reusa `lib/` y los tipos |
| Bundle grande / muchas rutas | **Code-splitting** por ruta (lazy de Vite/React) | Aditivo |
| App en otro idioma | Integrar librería **i18n** (ya está la base: textos en español, código en inglés) | Aditivo |

### 14.3 Límite honesto

El riesgo no es la estructura de carpetas (es sólida), sino **apoyar lógica de negocio compleja en el BaaS**. Regla: mientras la lógica pesada viva en `lib/` y en servicios desacoplados, cambiar de backend es mover datos, no reescribir el dominio. Mantener esa disciplina es lo que preserva la escalabilidad.

---

*Fin del plan técnico de Fase 1. Próximos pasos posibles: (a) generar el scaffolding real del repo, (b) escribir las migraciones partidas desde el SQL, o (c) detallar el contrato de la edge function de FX.*
