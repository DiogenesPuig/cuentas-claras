# Backlog — Mejoras (post Fase 2)

Ideas de mejora **no urgentes**, a encarar después de cerrar Fase 2. No son tickets
formales todavía: cuando se trabaje una, se materializa como archivo propio en `tasks/`
siguiendo la plantilla de `tasks/README.md`.

Acá vamos sumando ideas a medida que aparecen. Cada una anota: contexto, qué hacer,
y dependencias/costos a tener en cuenta (ej. dependencias nuevas que requieren aprobación
según `CLAUDE.md`).

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

### MEJ-3 — Mensaje de bienvenida "Bienvenido, &lt;nombre&gt;"
- **Qué:** mostrar en pantalla (arriba / en algún lugar visible, ej. el `Header` o el dashboard)
  un saludo tipo **"Bienvenido, &lt;nombre del usuario&gt;"**.
- **Contexto:** pedido del usuario (2026-06-27) con la app ya en producción. El nombre vive en
  `profiles.name` (lo setea el onboarding vía `upsertMyProfile`); el usuario autenticado se obtiene
  con el hook de auth (`useAuth`). Header en `src/app/layout/Header.tsx`.
- **A tener en cuenta:** sin dependencias nuevas. Definir el fallback si todavía no hay nombre
  (ej. parte local del email). Pensar i18n (texto en español, preparado para traducción).
- **Origen:** pedido del usuario, no urgente.

### MEJ-4 — Alias: varios nombres de titular → una misma cuenta/miembro
- **Diseño cerrado (2026-06-29) → ticket propio:** `tasks/MEJ-4-alias-titulares.md`.
- **Resumen de decisiones:** columna `holder_aliases text[]` en `accounts`; solo matching futuro
  (sin merge de duplicados existentes); UX = pantalla de gestión en Medios + prompt inline; incluye
  auto-dedup base (unificar `getOrCreateTransferAccount` con el matcher fuzzy del front).
- **Origen:** pedido del usuario, no urgente.

### MEJ-5 — Reportes: separar ingresos/gastos + donut de ingresos solo miembros
- **Qué (diseño acordado con el usuario, 2026-06-27):** reordenar `/reportes` así:
  ```
  [1] Ingresos vs Gastos  (arriba, macro: total INGRESOS y total GASTOS, sin desglose)
  [2] Donut GASTOS (izq)      [3] Donut INGRESOS (der)
  [4] Gráficos por filtro (más particulares; con un dato por defecto, nunca vacío)
  ```
- **Donut de INGRESOS [3]:** **por persona pero SOLO miembros** del workspace; todos los
  no-miembros (titulares de transferencia que no matchean a un miembro) se agrupan en una sola
  porción **"Otros"**. Motivo: el usuario recibe transferencias de gente que no conoce y no le
  interesa verlas individualizadas; sí pueden seguir apareciendo en el **filtro** (desplegable),
  pero no como porciones del resumen.
- **Donut de GASTOS [2]:** mantiene su desglose actual (categoría/persona). Si es por persona,
  aplicar el mismo criterio "solo miembros + Otros" por consistencia.
- **Contexto/archivos:** `src/features/reports/components/BarChart.tsx`, `DonutChart.tsx`,
  `ConsolidatedTotals.tsx`, `ReportTabs.tsx`; agregación pura en `src/features/reports/aggregate.ts`
  (ya distingue `income`/`expense` y mapea miembros vía `memberNameById` → lo no-mapeado = "Otros").
- **A tener en cuenta:** sin dependencias nuevas (Recharts ya está). El lumping "no-miembro → Otros"
  va en la lógica pura (`aggregate.ts`) y se testea. "Desconocido" = holder que no es miembro del
  workspace. El gráfico [1] es macro (dos totales/barras); ver por categorías en ingresos quedó
  descartado (el usuario eligió por persona/miembros).
- **Origen:** pedido del usuario, no urgente.

### ~~MEJ-6~~ — ✅ Aviso de "baja confianza" más vistoso — _hecho (toasts Sonner, PR #39)_
