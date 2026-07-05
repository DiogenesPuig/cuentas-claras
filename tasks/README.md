# Backlog — Fase 1 (MVP)

Un archivo por ticket. Cada uno es **autocontenido**: un subagente debería poder ejecutarlo leyendo solo ese archivo + los documentos que enlaza (`PRD.md`, `db/schema_fase1.sql`, `PLAN_TECNICO_FASE1.md`, `CLAUDE.md`).

## Cómo usar este backlog

1. Elegí el ticket de menor número cuyas **dependencias** estén completas.
2. Pasale a un subagente **un solo ticket** (no todo el backlog), para no inflar el contexto/costo.
3. Al terminar: `typecheck`, `lint`, `test`, y revisión contra los criterios de aceptación.
4. Marcá el ticket como hecho (mové el archivo a `tasks/done/` o tildá el encabezado).

## Orden y dependencias

> Los tickets completados se mueven a `tasks/done/`. Los marcados ✅ abajo ya están mergeados en `main`.
> El alcance de **Fase 2 (ingesta inteligente)** vive en `tasks/fase2/README.md` (parking lot, no se trabaja aún).
> Las **mejoras no urgentes (post Fase 2)** se anotan en `tasks/MEJORAS.md`.

**Sprint A — Cimientos**
- ✅ `A1` Scaffolding del proyecto — _sin dependencias_
- ✅ `A2` Migraciones + generación de tipos — depende de A1
- ✅ `A3` Cliente Supabase + Auth — depende de A2
- ✅ `A4` Perfil + onboarding (primer workspace) — depende de A3
- ✅ `A5` Workspace activo + layout/navegación — depende de A4

**Sprint B — Núcleo de registro**
- ✅ `B6` Categorías (seed + CRUD) — depende de A5
- ✅ `B7` Medios/tarjetas (lista plana + form, con extensiones) — depende de A5
- ✅ `B8` Alta/edición de movimientos — depende de B6, B7
- ✅ `B9` Dashboard mensual — depende de B8
- ✅ `B10` Movimientos: lista + filtros + búsqueda — depende de B8

**Sprint C — Visualización y grupo**
- ✅ `C11` Lógica de dinero y ciclos (money + billing) + tests — depende de A1
- ✅ `C12` Edge function de FX + tabla `fx_rates` + cron/keep-alive — depende de A2
- ✅ `C13` Reportes (tabs + gráficos) — depende de B10, C11, C12
- ✅ `C14` Exportar CSV/XLSX — depende de B10
- ✅ `C15` Grupo: miembros, roles, invitaciones — depende de A5

C11 y C12 pueden empezar en paralelo a Sprint B (solo dependen de cimientos).

**Sprint D — Mantenimiento / Calidad**
- ✅ `D16` Saneamiento de dependencias (npm audit + ESLint EOL) — depende de A1. _No bloquea features (son avisos de tooling de dev); saldar en un cambio controlado._
- ✅ `D17` CI en GitHub Actions (typecheck/lint/test/build en cada PR) — depende de A1.
- ✅ `SEC-1` Auditoría de seguridad (RLS/multi-tenant, secretos, deps) + guardas automáticas — _hecho (auditoría limpia; guardas: test RLS + npm/pip audit en CI + Dependabot; PR #47, `tasks/done/`). Repetir periódicamente._
- ✅ `REF-1` Revisión de refactor / estructura / performance — _hecho (memoización #57, dedupe #58,
  extracción de componentes de ReportsPage #59, auth→api #56, `Fab` muerto #61, `findTransferAccount`
  a `lib/` #62; `tasks/done/`). La extracción del hook `useTransferAttribution` quedó como idea
  menor en `tasks/MEJORAS.md` (bajo valor / alta rotación)._

**Bugs (detectados en producción)**
- ✅ `BUG-1` Selector de grupo muestra el mismo workspace duplicado (uno por miembro) — _hecho (filtro por usuario en `listMyWorkspaces`, `tasks/done/`)_
- ✅ `BUG-2` No se puede aceptar una invitación sin tener un grupo previo — _hecho (migración 0013, `tasks/done/`)_
- ✅ `BUG-3` El form de alta no se vacía al reintentar con otro comprobante — _hecho (limpia la precarga previa al reintentar, `tasks/done/`)_
- ✅ `BUG-4` Página de error/404 propia (cuadro centrado) en vez de la default de React Router — _hecho (ErrorPage + errorElement + catch-all `*`, `tasks/done/`)_
- ✅ `BUG-5` Los impuestos se tratan como persona/medio; manejarlos distinto — _hecho (categoría "Impuestos" + heurística `isInstitutionalPayee`, sección residual del resumen sin medio; `tasks/done/`)_
- ✅ `BUG-6` Donut de "Detalle por filtro" en Reportes no aplica el apodo (MEJ-8) — _hecho (PR #60,
  `detailGroupsView` aplica el apodo cuando el detalle es por persona, `tasks/done/`)_
- ✅ `BUG-7` Carrera en el alta lazy del medio `'transfer'` — _hecho (PR #62, token de corrida +
  flag `cancelled` por invocación, `tasks/done/`)_
- ✅ `BUG-8` `findTransferAccount` no caía a match fuzzy con miembro sin cuenta vinculada → duplicaba
  medio — _hecho (PR #62, movida a `lib/` + fallback fuzzy, `tasks/done/`)_
- ✅ `BUG-9` Falta guard anti doble-submit en `TransactionForm`/`StatementImport` — _hecho (PR #62,
  guard `useRef` en los handlers, `tasks/done/`)_
- `BUG-10` OCR de comprobantes: origen/destino de transferencia invertidos o incompletos en
  Naranja X, BNA y Mercado Pago — reportado probando en local (2026-07-01),
  `tasks/BUG-10-ocr-origen-destino-transferencia.md`.
- `BUG-11` El modal "Nuevo grupo" se posiciona mal (pegado arriba/recortado) al abrirlo desde el
  "+" del Header, por el `backdrop-blur` del header (containing block para `fixed`). Fix: portal a
  `document.body`. Reportado en local (2026-07-05), `tasks/BUG-11-dialogo-nuevo-grupo-mal-posicionado.md`.

## Orden de resolución recomendado (actualizado 2026-07-05)

Ya hechos y mergeados: **BUG-6** (#60), **REF-1**/`Fab` muerto (#61) y **BUG-7+8+9** (#62).
Pendiente, en orden sugerido:

1. **BUG-11** — quick win independiente (portal a `document.body` en `CreateWorkspaceDialog`).
2. **Triage Dependabot — tanda de bajo riesgo**: mergear (con CI verde) #48/#49/#50
   (GitHub Actions del CI) y #51 (grupo minor-and-patch de npm).
3. **BUG-10** cuando el usuario provea texto real (anonimizado) de los comprobantes de
   Naranja X, BNA y Mercado Pago — hoy está bloqueado en eso.
4. **Triage Dependabot — majors (decisión + prueba local, uno por uno)**: #53 (**React
   18→19**: decisión de arquitectura, el stack aprobado en `CLAUDE.md` dice React 18 →
   escalar a Opus), #54 (tailwind-merge 2→3), #52 (@types/node 20→26). Si no conviene
   actualizar todavía, se cierran y Dependabot los re-abre más adelante.
5. **Mejoras post-Fase 2** (`tasks/MEJORAS.md`): MEJ-4 (identidad de persona, la más grande),
   MEJ-1/MEJ-2 (necesitan aprobar deps nuevas). Baja prioridad.

## Plantilla de ticket

```
# [ID] Título

**Sprint:** _ · **Modelo sugerido:** _ · **Depende de:** _

## Objetivo
## Contexto (links a docs)
## Archivos a crear/editar
## Pasos
## Criterios de aceptación  (checklist)
## Fuera de alcance
## Tests
## Por qué este modelo
```

## Definition of Done

Ver `CLAUDE.md` → "Definición de hecho". Resumen: compila, lint ok, tests (si hay lógica pura), cumple criterios de aceptación, sin scope creep, sin dependencias nuevas no autorizadas, y **si el ticket trajo migraciones, quedan aplicadas en remoto** (no alcanza con escribir el `.sql`).
