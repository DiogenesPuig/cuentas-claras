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
   Grupo→miembros (PR #44, mergeado). Migración 0015 aplicada en remoto (verificado 2026-07-02).
5. **MEJ-4** — identidad de persona (alias + personas sin cuenta). El más grande; hacerlo **último**:
   - 4a. **Parte A (alias)**: diseño cerrado → implementar (migración `holder_aliases`).
   - 4b. **Parte B (personas sin cuenta)**: **cerrar diseño con Opus** (modelo de datos/RLS, promoción
     placeholder→cuenta) y recién ahí implementar. Conviene al final por tamaño y por tocar el modelo
     de identidad.

Notas: MEJ-8 y MEJ-4 son independientes (se pueden reordenar). MEJ-1 ya hecho (PR #79). MEJ-2 (necesita dep nueva a
aprobar) sigue pendiente y de baja prioridad.

## Ideas

### ~~MEJ-1~~ — ✅ Date-picker con calendario en el form de movimientos — _hecho (PR #79, `tasks/done/`)_
- `DateField` (`src/components/DateField.tsx`, reutilizable): mismo input `DD/MM/AAAA` tipeable a
  mano + botón que abre `ui/calendar.tsx` (shadcn `Calendar` sobre `react-day-picker`, en español).
  El calendario se porta a `document.body` con `position: fixed` (coordenadas medidas desde el
  input, con flip hacia arriba si no entra abajo) para no vivir dentro del formulario: abrirlo no le
  agrega scroll ni le cambia el tamaño al modal. Cableado en "Fecha" y "Se cobra" de
  `TransactionForm`; sin cambios en validación/guardado (sigue usando `displayToIsoDate`/
  `isoToDisplayDate`).

### MEJ-2 — Secciones de Reportes reordenables a gusto (drag & drop)
- **Qué:** permitir que el usuario **mueva/ordene las secciones** de `/reportes`
  (general, detalle, mes a mes, anual) a su gusto, y que el orden se recuerde
  (localStorage o preferencia por usuario).
- **Contexto:** pedido del usuario (2026-06-23) junto con el rediseño general/detalle + anual.
  El layout actual es fijo (orden: general → detalle → mes a mes → anual).
- **Dependencia APROBADA (2026-07-07):** `@dnd-kit/*` habilitada → se implementa la versión con
  **drag & drop** (falta instalarla al trabajar el ticket). La alternativa sin dep (botones
  subir/bajar) queda descartada.
- **Origen:** pedido del usuario, marcado por él mismo como **opcional** (baja prioridad).

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
  Reportes (detalle por persona) y Grupo→lista de miembros. Migración aplicada en remoto
  (verificado con `supabase migration list --linked`, 2026-07-02).

### ~~MEJ-5~~ — ✅ Reportes: separar ingresos/gastos + donut de ingresos solo miembros — _hecho (PR #41, `tasks/done/`)_
- Reordenó `/reportes` → [1] ingresos vs gastos (macro), [2] donut gastos + [3] donut ingresos por
  persona (solo miembros; no-miembros → "Otros") en espejo con zona gris del complemento, [4] detalle
  por filtro. Lumping no-miembro→"Otros" y `aggregateByPersonaMembersOnly` en `aggregate.ts` (puro).

### ~~MEJ-6~~ — ✅ Aviso de "baja confianza" más vistoso — _hecho (toasts Sonner, PR #39)_

### MEJ-10 — Extraer `useTransferAttribution` de `TransactionForm` (refactor menor)
- **Qué:** mover la lógica de atribución de transferencia de `TransactionForm.tsx` (los dos
  `useEffect` de alta lazy/banco + los derivados `ownerHolder`/`ownerBank`/`transferMatch`/
  `matchedMember`) a un hook `useTransferAttribution`, para achicar el componente (~630 líneas).
- **Contexto:** surgió en REF-1. La parte pura (`findTransferAccount`) ya se movió a
  `lib/transfer-account.ts` con tests (PR #62); esto es solo la envoltura presentacional.
- **A tener en cuenta:** bajo valor / alta rotación (toca un área de riesgo: dinero/transferencias).
  Sin cambios de comportamiento; cubierto por los tests de `TransactionForm`. No urgente.
- **Origen:** revisión REF-1 (2026-07-05).

### ~~MEJ-9~~ — ✅ Ingesta: clave HMAC de test demasiado corta (warning de PyJWT) — _hecho_
- El secreto corto no era el fixture (`TEST_SECRET`, ya de 38 bytes), sino la clave inline
  `"wrong-secret"` (12 bytes) de `test_rejects_bad_signature` en `test_auth.py`; se alargó a
  32+ bytes. Solo tests, sin cambios de producción.

### MEJ-21 — Selección múltiple + reasignación masiva de categoría
- **Qué:** en Movimientos, poder seleccionar varios movimientos (checkboxes, sobre todo los
  "sin categoría" que deja ver `MEJ-20`) y asignarles una categoría de una sola acción, en vez
  de editarlos uno por uno. Reusar "Otros gastos"/"Otros ingresos" (categorías globales ya
  existentes) como sugerencia rápida, pero permitir elegir cualquier categoría.
- **Contexto:** pedido del usuario (2026-08-03) al reportar que faltaba poder encontrar/agrupar
  movimientos sin categoría. Se separó del filtro simple (`MEJ-20`) porque implica construir
  selección múltiple desde cero: hoy no existe en `TransactionList`/`TransactionRow` (verificado,
  no hay checkboxes ni acciones bulk en ningún lado de Movimientos).
- **A tener en cuenta:** diseño de UI/UX a afinar con el usuario antes de implementar (qué pasa
  con selección + otros filtros activos, límite de items, feedback de la acción). No es un
  ticket "replicar patrón existente" como `MEJ-20`; conviene pasar por Opus para cerrar el
  diseño antes de implementar.
- **Origen:** pedido del usuario, no urgente (post `MEJ-20`).
