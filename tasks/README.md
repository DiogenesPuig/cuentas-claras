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
- ✅ `BUG-11` El modal "Nuevo grupo" se posicionaba mal al abrirlo desde el "+" del Header
  (`backdrop-blur` = containing block para `fixed`) — _hecho (PR #63, portal a `document.body`,
  `tasks/done/`)_
- ✅ `BUG-12` Editar un movimiento llevaba al tope de la página — _hecho (PR #67, alta/edición en
  modal + componente `Modal` reutilizable, `tasks/done/`)_
- ✅ `BUG-13` Los movimientos **sin medio** no se podían encontrar — _hecho (PR #69, opción "Sin medio"
  en el filtro → `account_id IS NULL`, `tasks/done/`)_
- ✅ `BUG-14` Editar el banco de un medio no se reflejaba en las listas — _hecho (PR #69, helper
  `accountDisplayName` antepone el banco en movimientos/filtro/Medios; sub-línea del medio simplificada
  a titular + moneda, `tasks/done/`)_
- ✅ `BUG-15` Editar un medio abría el form al pie de toda la lista — _hecho (PR #68, edición inline
  dentro de la tarjeta, `tasks/done/`)_
- `BUG-17` Cambiar mi nombre no se refleja en Medios/filtro (`holder_name` denormalizado) → persona
  duplicada. Reportado 2026-07-09. Lo arregla `IDENT-1` (nombre vivo); o fix chico de display aparte —
  `tasks/BUG-17-cambiar-nombre-no-actualiza-medios.md`.
- ✅ `BUG-16` Entrar por link de invitación como usuario NUEVO caía en "crear grupo" — _hecho (PR #71,
  `lib/pending-invite` en sessionStorage: RequireAuth guarda / RequireWorkspace retoma / InviteAccept
  limpia; cubre el OAuth de Google, `tasks/done/`)_

**Mejoras / ingesta (nuevas, 2026-07-06/07)**
- `MEJ-11` Reportes: desglose de categorías al ver por persona — `tasks/MEJ-11-reportes-categorias-por-persona.md`.
- `MEJ-12` Efectivo por defecto: un medio "Efectivo" por miembro con dueño (Etapa 1 de identidad/efectivo,
  diseño cerrado 2026-07-07) — `tasks/MEJ-12-efectivo-por-miembro.md`.
- `MEJ-1` Date-picker con calendario — **dep `react-day-picker` APROBADA (2026-07-07)**, lista para implementar (`tasks/MEJORAS.md`).
- `MEJ-2` Reordenar secciones de Reportes (drag & drop) — **dep `@dnd-kit` APROBADA (2026-07-07)**, versión DnD (`tasks/MEJORAS.md`).
- `MEJ-13` Total de gastos en /movimientos respetando los filtros (hoy solo muestra el conteo) — `tasks/MEJ-13-total-gastos-en-movimientos.md`.
- `MEJ-14` Botón ver/ocultar contraseña en el import de resumen — `tasks/MEJ-14-ver-contrasena-import-resumen.md`.
- `MEJ-15` Eliminar un grupo (workspace) — destructivo, requiere cerrar diseño RLS/cascada/confirmación — `tasks/MEJ-15-eliminar-grupo.md`.
- `MEJ-16` Separar categoría "Transporte" (viajes) de "Auto" (nafta/mantenimiento) — `tasks/MEJ-16-categoria-auto-vs-transporte.md`.
- `MEJ-18` Memoria de categoría por comercio: aprende de las correcciones (comercio→categoría, por
  workspace, gana sobre las keywords de F2-6) — diseño de datos/RLS cerrado con el usuario 2026-07-10;
  falta cerrar la "clave de comercio" — `tasks/MEJ-18-memoria-categoria-por-comercio.md`.
- ✅ `F2-14` Parser del resumen de Banco Nación (BNA MasterCard Black) + banco no reconocido — _hecho
  (PR #66: el header venía en plural "DETALLES DEL MES"; `tasks/done/`). **Micro redeployado al Space
  de Hugging Face y verificado en prod (2026-07-07): reconoce el banco.**_

## Observaciones de uso (2026-07-06) — agrupadas, ORDEN A DECIDIR

Lote de cosas notadas usando la app. Se agrupan por naturaleza; **el orden de trabajo se decide con
el usuario** (no fijado todavía).

- **Grupo A — arreglos chicos e independientes (sin diseño):** `BUG-12` (editar en modal),
  `BUG-13` (buscar movimientos sin medio), `BUG-14` (banco editado no se ve), `MEJ-11` (categorías
  por persona en reportes).
- **Grupo B — ingesta, bloqueado en sample:** `F2-14` (parser BNA + banco), se junta con `BUG-10`
  (ambos esperan texto real anonimizado de resúmenes/comprobantes).
- **Grupo C — identidad (transferencia/efectivo/persona sin cuenta) → `IDENT-1` (DISEÑO CERRADO
    2026-07-09).** La persona pasa a ser un **campo del movimiento** (`transactions.owner_member_id`);
    un solo "Transferencia" y un solo "Efectivo" compartidos; personas sin cuenta = miembro placeholder;
    migración que conserva la historia; **todo junto**. Ticket maestro:
    `tasks/IDENT-1-persona-en-el-movimiento.md` (absorbe MEJ-4B Parte B, MEJ-12 y BUG-17). Grande, con
    migración en `transactions`/`workspace_members` + reportes + alta.
  - `MEJ-12` (efectivo por miembro) → **REEMPLAZADO** por IDENT-1.
  - `MEJ-4` Parte A (alias) hecho; Parte B → absorbida en IDENT-1.

## Orden de resolución recomendado (actualizado 2026-07-05)

Ya hechos y mergeados: **BUG-6** (#60), **REF-1**/`Fab` muerto (#61), **BUG-7+8+9** (#62),
**BUG-11** (#63), **MEJ-4 Parte A** completa (#64 + #65 slice 2, migración 0017 en remoto) y
**F2-14** (#66, micro redeployado a HF).

**Decisiones de dependencias (cerradas 2026-07-07):**
- **React se mantiene en 18** → PR #53 (React 19) **cerrado**. Subir a 19 solo con un ticket dedicado.
- **tailwind-merge 2→3 (#54) y @types/node 20→26 (#52): se aguantan** → PRs **cerrados**.
- **`react-day-picker` (MEJ-1) y `@dnd-kit` (MEJ-2): APROBADAS** → ambas mejoras quedan implementables.

1. **Triage Dependabot — tanda de bajo riesgo** (pendiente, no decisión): mergear (con CI verde)
   #48/#49/#50 (GitHub Actions del CI) y #51 (grupo minor-and-patch de npm).
2. **BUG-10** cuando el usuario provea texto real (anonimizado) de los comprobantes de
   Naranja X, BNA y Mercado Pago — hoy está bloqueado en eso.
3. **Todo lo demás con diseño/decisión ya cerrado y listo para ejecutar** (orden fino a acordar):
   Grupo A (`BUG-12/13/14`, `MEJ-11`), `MEJ-12` (efectivo etapa 1), `MEJ-1`/`MEJ-2` (deps aprobadas),
   luego `MEJ-4` Parte B (etapa 2, la más grande) y `MEJ-10` (refactor menor).

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
