# Backlog — Mejoras (post Fase 2)

Ideas de mejora **no urgentes**, a encarar después de cerrar Fase 2. No son tickets
formales todavía: cuando se trabaje una, se materializa como archivo propio en `tasks/`
siguiendo la plantilla de `tasks/README.md`.

Acá vamos sumando ideas a medida que aparecen. Cada una anota: contexto, qué hacer,
y dependencias/costos a tener en cuenta (ej. dependencias nuevas que requieren aprobación
según `CLAUDE.md`).

## Orden recomendado de trabajo (actualizado 2026-06-29)

Próximos tickets a ejecutar, de más simple/independiente a más grande. Cada uno en su **rama propia
desde `main`**, probado en local antes de mergear (regla 2026-06-27):

1. ~~**MEJ-5**~~ — ✅ separar gráficos ingresos/gastos + donuts en espejo (PR #41, mergeado).
2. ~~**MEJ-7**~~ — ✅ editar mi perfil (nombre global) + acceso desde Header y TabBar (PR #42, mergeado).
3. ~~**MEJ-3**~~ — ✅ saludo "¡Hola, &lt;nombre&gt;!" en Header y landing (PR #43, mergeado).
4. ~~**MEJ-8**~~ — ✅ apodos privados por usuario en DB con RLS, editables desde Reportes y desde
   Grupo→miembros (PR #44, mergeado). _Falta `supabase db push` al remoto para activarlo en prod._
5. **MEJ-4** — identidad de persona (alias + personas sin cuenta). El más grande; hacerlo **último**:
   - 4a. **Parte A (alias)**: diseño cerrado → implementar (migración `holder_aliases`).
   - 4b. **Parte B (personas sin cuenta)**: **cerrar diseño con Opus** (modelo de datos/RLS, promoción
     placeholder→cuenta) y recién ahí implementar. Conviene al final por tamaño y por tocar el modelo
     de identidad.

Notas: MEJ-8 y MEJ-4 son independientes (se pueden reordenar). MEJ-1/MEJ-2 (necesitan deps nuevas a
aprobar) siguen pendientes y de baja prioridad.

## Ideas

### MEJ-1 — Date-picker con calendario en el form de movimientos
- **Qué:** reemplazar los inputs de fecha de texto `DD/MM/AAAA` del `TransactionForm`
  (`src/features/transactions/components/TransactionForm.tsx`) por un date-picker con
  **calendario** que muestre `DD/MM/AAAA`, usando el componente `Calendar` de shadcn/ui.
- **Contexto:** en el commit `7a32211` se pasó de `<input type="date">` (formato dependiente
  del locale del navegador, no forzable) a input de texto con conversión a ISO vía
  `isoToDisplayDate`/`displayToIsoDate` (`src/features/transactions/format.ts`). El trade-off
  fue **perder el calendario nativo**.
- **A tener en cuenta:** el `Calendar` de shadcn requiere la dependencia `react-day-picker`,
  que **no está en el stack aprobado** de `CLAUDE.md` → hay que aprobar la dependencia antes
  (regla "no agregar deps sin justificar"). La conversión ISO↔display ya existe y se reutiliza;
  el cambio es solo de UI.
- **Origen:** pedido del usuario (2026-06-22), no urgente.

### MEJ-2 — Secciones de Reportes reordenables a gusto (drag & drop)
- **Qué:** permitir que el usuario **mueva/ordene las secciones** de `/reportes`
  (general, detalle, mes a mes, anual) a su gusto, y que el orden se recuerde
  (localStorage o preferencia por usuario).
- **Contexto:** pedido del usuario (2026-06-23) junto con el rediseño general/detalle + anual.
  El layout actual es fijo (orden: general → detalle → mes a mes → anual).
- **A tener en cuenta:** requiere una librería de drag & drop (ej. `@dnd-kit/*`) que **no está
  en el stack aprobado** de `CLAUDE.md` → aprobar la dependencia antes (regla "no agregar deps
  sin justificar"). Alternativa sin dep: botones "subir/bajar" por sección (más barato, sin DnD).
- **Origen:** pedido del usuario, marcado por él mismo como **opcional**.

### ~~MEJ-3~~ — ✅ Mensaje de bienvenida "¡Hola, &lt;nombre&gt;!" — _hecho (PR #43)_
- Componente `WelcomeGreeting` (nombre del perfil con fallback al email) en el `Header` y en
  `GroupsLanding`. Sin migración ni deps.

### MEJ-4 — Identidad de persona: alias de titulares + personas del grupo sin cuenta
- **Ticket propio (unifica dos pedidos):** `tasks/MEJ-4-alias-titulares.md`.
- **Parte A — Alias de titulares (diseño cerrado 2026-06-29):** columna `holder_aliases text[]` en
  `accounts`; solo matching futuro (sin merge de duplicados existentes); UX = gestión en Medios +
  prompt inline; auto-dedup base (unificar `getOrCreateTransferAccount` con el matcher fuzzy del front).
- **Parte B — Personas del grupo sin cuenta (diseño A CERRAR):** que un no-miembro que es del grupo
  se vea individualizado en reportes (no en "Otros"), **a nivel grupo**. Se unió con A porque tocan el
  mismo modelo de identidad (decisión del usuario 2026-06-29). Requiere sesión de diseño con Opus.
- **Origen:** pedido del usuario (A: 2026-06-27; B: 2026-06-29), no urgente.

### ~~MEJ-7~~ — ✅ Editar mi perfil: cambiar mi nombre (global) — _hecho (PR #42, `tasks/done/`)_
- Pantalla `/perfil` que edita `profiles.name` (global); `useMyProfile`/`useUpdateMyProfile` (invalida
  el directorio de miembros de reportes y los del grupo). Acceso desde el ícono del Header y la tab
  "Perfil" del TabBar.

### ~~MEJ-8~~ — ✅ Apodos privados: renombrar a otras personas solo para mí (por usuario) — _hecho (PR #44, `tasks/done/`)_
- Apodos por `(usuario, workspace, personaKey)` en la base con RLS (privados, sincronizan entre
  dispositivos). Tabla `persona_aliases` (migración 0015). Feature `aliases` + edición inline desde
  Reportes (detalle por persona) y Grupo→lista de miembros. _Pendiente: `supabase db push` al remoto._

### ~~MEJ-5~~ — ✅ Reportes: separar ingresos/gastos + donut de ingresos solo miembros — _hecho (PR #41, `tasks/done/`)_
- Reordenó `/reportes` → [1] ingresos vs gastos (macro), [2] donut gastos + [3] donut ingresos por
  persona (solo miembros; no-miembros → "Otros") en espejo con zona gris del complemento, [4] detalle
  por filtro. Lumping no-miembro→"Otros" y `aggregateByPersonaMembersOnly` en `aggregate.ts` (puro).

### ~~MEJ-6~~ — ✅ Aviso de "baja confianza" más vistoso — _hecho (toasts Sonner, PR #39)_
