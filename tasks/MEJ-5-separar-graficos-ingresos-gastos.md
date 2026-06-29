# MEJ-5 Reportes: separar ingresos/gastos + donut de ingresos solo miembros

**Sprint:** Mejoras (post Fase 2) · **Modelo sugerido:** Sonnet (diseño cerrado con el usuario, 2026-06-27) · **Depende de:** C13 (reportes), F2-10 (dedup de persona por miembro)

## Objetivo
Reordenar `/reportes` para que **ingresos y gastos estén separados** (hoy se mezclan en el desglose
general) y que el **donut de ingresos** muestre solo a los **miembros** del grupo, agrupando a los
no-miembros en una sola porción **"Otros"**. Motivo del usuario: recibe transferencias de gente que
no conoce y no quiere verlas individualizadas en el resumen (sí en el filtro).

## Diseño acordado (con el usuario, 2026-06-27)
Layout de la parte superior de `/reportes`:
```
[1] Ingresos vs Gastos   (macro: total INGRESOS y total GASTOS del período, sin desglose)
[2] Donut GASTOS (izq)        [3] Donut INGRESOS (der)
[4] Gráficos por filtro   (detalle particular; con un dato por defecto, nunca vacío)
```
- **[1] Ingresos vs Gastos:** dos totales/barras macro (total ingresos y total gastos consolidados),
  sin desglose por dimensión. Es la foto de arriba.
- **[2] Donut GASTOS:** mantiene el desglose actual (categoría/persona). Si el desglose es **por
  persona**, aplica el mismo criterio "solo miembros + Otros" por consistencia.
- **[3] Donut INGRESOS:** **por persona, SOLO miembros** del workspace. Todos los no-miembros
  (titulares de transferencia que no matchean a un miembro) se agrupan en **una sola porción
  "Otros"**. Los no-miembros pueden seguir apareciendo en el **filtro** [4], pero **no** como
  porciones del resumen.
- **[4] Gráficos por filtro:** el bloque de detalle por filtro ya existente; debe arrancar con un
  dato por defecto (nunca vacío).

Los bloques **mes a mes** (`BarChart`) y **anual** que ya existen se mantienen debajo.

## Contexto / archivos
- Pantalla: `src/app/ReportsPage.tsx` (hoy: bloque general con tabs de dimensión + detalle por
  filtro + mes a mes + anual).
- Feature reports (`src/features/reports/`):
  - `aggregate.ts` (PURO, testeado) — ya distingue `income`/`expense` y resuelve la identidad de
    persona en `personaIdentity`: devuelve clave `member:<owner_member_id>` para miembros o
    `name:<holder normalizado>` para no-miembros (F2-10). **Acá va el lumping no-miembro → "Otros".**
  - `components/DonutChart.tsx`, `ConsolidatedTotals.tsx`, `BarChart.tsx`, `ReportTabs.tsx`,
    `GroupBreakdown.tsx`, `PersonaBreakdown.tsx`, `chartColors.ts`.
- Sin dependencias nuevas: Recharts ya está en el stack.

## Pasos
1. **`aggregate.ts`** (lógica pura + tests): agregar una opción/función para la vista "por persona
   solo-miembros" que **colapse todas las claves `name:*` (no-miembros) en una única porción
   "Otros"**, dejando las `member:*` individuales. Reusar `personaIdentity` (no duplicar criterio).
   "Otros" agrupa el total de los no-miembros. Si no hay no-miembros, no aparece la porción.
2. **`ReportsPage.tsx`**: reordenar la parte superior al layout `[1]`/`[2]`/`[3]`/`[4]`:
   - [1] dos totales macro (ingresos / gastos) — reutilizar `ConsolidatedTotals` o un bloque simple.
   - [2] donut de **gastos** (desglose actual; por persona usa solo-miembros + Otros).
   - [3] donut de **ingresos** por persona solo-miembros + Otros (paso 1).
   - [4] el bloque de detalle por filtro existente, con dato por defecto.
3. Verificar que el **filtro** [4] siga pudiendo mostrar no-miembros individualmente (no se toca su
   lógica; el lumping es solo para los donuts de resumen).
4. `typecheck` / `lint` / `test`. Actualizar READMEs de carpeta si se crean/borran archivos.

## Criterios de aceptación
- [ ] La parte superior de `/reportes` muestra: [1] ingresos vs gastos (macro), [2] donut gastos,
      [3] donut ingresos, [4] detalle por filtro — en ese orden.
- [ ] El donut de **ingresos** lista solo miembros; todos los no-miembros caen en una única porción
      "Otros" (que no aparece si no hay no-miembros).
- [ ] El donut de **gastos** por persona aplica el mismo criterio solo-miembros + "Otros".
- [ ] El **filtro** [4] puede seguir mostrando un no-miembro puntual (no se pierde el detalle).
- [ ] Sin dependencias nuevas; lógica de lumping en `aggregate.ts` con tests que pasan.
- [ ] Los bloques mes a mes y anual siguen funcionando.

## Fuera de alcance
- Donut de ingresos por **categoría** (el usuario eligió por persona/miembros).
- Reordenar secciones a gusto / drag & drop (eso es MEJ-2).
- Cambios en el cálculo de FX/consolidación (se reutiliza el existente).

## Por qué este modelo
Sonnet: el criterio de diseño ya está cerrado; es lógica pura acotada en `aggregate.ts` (lumping a
"Otros") + recomposición de una pantalla existente con componentes que ya existen, sin deps nuevas.
