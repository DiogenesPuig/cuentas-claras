# REF-1 Revisión de refactor / estructura / performance

**Sprint:** Mantenimiento / Calidad · **Modelo sugerido:** Opus (revisar y priorizar) + skills `/code-review` y `/simplify` · **Depende de:** — (transversal)

## Objetivo
Pasada de revisión para detectar **deuda técnica** y oportunidades de mejora **sin cambiar
comportamiento**: estructura del proyecto, duplicación, componentes/funciones demasiado grandes, y
performance (recálculos innecesarios). Produce una lista priorizada y luego **refactors chicos y
seguros** (cubiertos por tests), uno por PR.

## Principio rector
**Refactor = mismo comportamiento, mejor forma.** Cada cambio debe:
- estar respaldado por tests (si toca `lib/` puro, tests verdes antes y después);
- ser acotado (un PR por refactor, fácil de revisar y revertir);
- respetar las fronteras de `CLAUDE.md` (api.ts única capa Supabase, `lib/` puro, JSX sin lógica de
  datos, portabilidad).

## Estado (actualizado 2026-07-02)

Lo grueso ya está mergeado: memoización de la pipeline de `ReportsPage` (PR #57), dedupe de
`toMatchable` en `accountsToMatchable` (PR #58), extracción de sub-bloques de `ReportsPage` a
componentes (PR #59), y `getSession`/`onAuthStateChange` movidos a `api.ts` (PR #56). La revisión
también destapó BUG-6/7/8/9 (registrados como tickets propios).

**Pasada corta ya revisada (2026-07-02).** Resultado y estado de cada hallazgo:

- ✅ **Código muerto `Fab.tsx`**: era huérfano (no lo usaba nadie; su README lo daba como "usado en
  `DashboardPage`", página que ya no existe). Borrado en PR #61.
- ⏳ **`TransactionForm.tsx` (623 líneas, varias responsabilidades)**: extraer la lógica de
  transferencia a un hook `useTransferAttribution` — **se hace dentro del PR de BUG-7+8+9** (mismo
  código; ver nota en `tasks/BUG-7-...md`). No refactorizar antes.
- 🔎 **`StatementImport.tsx` (341 líneas)**: cohesivo (un solo wizard). Único candidato: extraer el
  bloque JSX que renderiza cada tarjeta (líneas ~226-313) a un `StatementCard`. Beneficio moderado,
  **prioridad baja**; evaluar de paso con BUG-9 o dejar.
- ✅ **Fronteras Supabase**: limpias (ningún `hooks`/componente/`lib`/`schema` importa `supabase`/
  `database.types` fuera de `api.ts`).
- ✅ **Barrels**: los "sin uso" que marca `ts-prune` son re-exports de `index.ts` (API pública de
  cada feature) → falsos positivos, no tocar.

**Cierre:** este ticket ya no justifica un PR de refactor propio. Se cierra (mover a `tasks/done/`)
cuando mergee el PR de BUG-7+8+9 (que trae el `useTransferAttribution`). El único refactor
independiente (Fab muerto) ya salió en PR #61.

## Áreas a revisar (con candidatos ya detectados)
### Estructura / arquitectura
- [x] Respeto de fronteras: ningún `hooks.ts`/componente/`lib`/`schema` importa `supabase` ni
      `database.types` (solo `api.ts`). *Cómo:* `grep -rn "from '@/lib/supabase'\|database.types" src`
      y ver que solo aparezca en archivos `api.ts`. _Verificado limpio (2026-07-02)._
- [ ] **Higiene de barrels** (memoria conocida): módulos/tests puros no deben importar del barrel de
      una feature (arrastra `api.ts`→`supabase` y rompe sin env). Verificar imports concretos donde
      corresponde.
- [ ] READMEs por carpeta al día (DoD) y consistencia de la convención `api/hooks/schema/components`.

### Componentes/funciones grandes (candidatos)
- [x] **`src/app/ReportsPage.tsx`**: creció bastante (MEJ-5 + MEJ-8). Evaluar extraer sub-bloques
      (resumen [2]/[3], detalle [4]) a componentes y mover el armado de datos a hooks/selectores, para
      que la página quede declarativa. _Hecho (PR #59)._
- [ ] `TransactionForm.tsx` y `StatementImport.tsx`: revisar tamaño/responsabilidades.

### Performance (recálculos)
- [x] **`ReportsPage`**: hoy varias agregaciones pesadas (`aggregateByDimension`,
      `aggregateByPersonaMembersOnly`, `personaSpending`, `monthlySeries`, consolidaciones) se calculan
      **en el cuerpo del componente**, fuera de `useMemo` → se recomputan en cada render (ej. al editar
      un apodo, al tipear en un filtro). Evaluar memoizar por dependencias (`monthTransactions`,
      `dimension`, `rateFor`, `aliases`, etc.). Medir antes/después; no premium-optimizar sin necesidad.
      _Hecho (PR #57)._
- [ ] Revisar listas/`map` sin `key` estable o con trabajo redundante por ítem.

### Duplicación / simplificación
- [ ] Patrones repetidos entre features (hooks de react-query, invalidaciones, forms) que se puedan
      unificar sin sobre-abstraer.
- [ ] Código muerto / exports sin uso (`ts-prune` o `eslint` ya marca algunos).

## Cómo encararlo (sugerencia)
1. Correr `/code-review` (bugs) y `/simplify` (calidad) sobre el estado actual para juntar hallazgos.
2. Armar una **lista priorizada** (impacto × riesgo × esfuerzo). No refactorizar todo: elegir lo que
   duele (ReportsPage perf/estructura es el candidato más claro).
3. Por cada ítem elegido: PR chico, tests verdes, diff revisable. Sin cambios de comportamiento.
4. Lo que sea más grande (ej. partir ReportsPage) → su propio ticket si hace falta.

## Criterios de aceptación
- [ ] Informe de hallazgos priorizado (qué refactorizar, por qué, riesgo/beneficio).
- [ ] Refactors acordados aplicados en PRs chicos, con `typecheck`/`lint`/`test`/`build` verdes y
      **sin cambios de comportamiento** observables.
- [ ] Si se memoiza/optimiza, queda una nota de qué se mejoró (y, si aplica, una medición simple).

## Fuera de alcance
- Reescrituras grandes o cambios de stack (no es el objetivo).
- Nuevas features (esto es solo forma/estructura/perf).
