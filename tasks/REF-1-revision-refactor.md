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

## Áreas a revisar (con candidatos ya detectados)
### Estructura / arquitectura
- [ ] Respeto de fronteras: ningún `hooks.ts`/componente/`lib`/`schema` importa `supabase` ni
      `database.types` (solo `api.ts`). *Cómo:* `grep -rn "from '@/lib/supabase'\|database.types" src`
      y ver que solo aparezca en archivos `api.ts`.
- [ ] **Higiene de barrels** (memoria conocida): módulos/tests puros no deben importar del barrel de
      una feature (arrastra `api.ts`→`supabase` y rompe sin env). Verificar imports concretos donde
      corresponde.
- [ ] READMEs por carpeta al día (DoD) y consistencia de la convención `api/hooks/schema/components`.

### Componentes/funciones grandes (candidatos)
- [ ] **`src/app/ReportsPage.tsx`**: creció bastante (MEJ-5 + MEJ-8). Evaluar extraer sub-bloques
      (resumen [2]/[3], detalle [4]) a componentes y mover el armado de datos a hooks/selectores, para
      que la página quede declarativa.
- [ ] `TransactionForm.tsx` y `StatementImport.tsx`: revisar tamaño/responsabilidades.

### Performance (recálculos)
- [ ] **`ReportsPage`**: hoy varias agregaciones pesadas (`aggregateByDimension`,
      `aggregateByPersonaMembersOnly`, `personaSpending`, `monthlySeries`, consolidaciones) se calculan
      **en el cuerpo del componente**, fuera de `useMemo` → se recomputan en cada render (ej. al editar
      un apodo, al tipear en un filtro). Evaluar memoizar por dependencias (`monthTransactions`,
      `dimension`, `rateFor`, `aliases`, etc.). Medir antes/después; no premium-optimizar sin necesidad.
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
