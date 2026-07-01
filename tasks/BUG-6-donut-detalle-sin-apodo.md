# BUG-6 El donut de "Detalle por filtro" en Reportes no aplica el apodo (MEJ-8)

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Cuando el bloque "Detalle por filtro" de `/reportes` se ve por persona, el donut debe mostrar
el **apodo** (MEJ-8) igual que la lista de al lado, no el nombre real.

## Contexto
- Detectado en revisión REF-1 (2026-07-01), leyendo `src/app/ReportsPage.tsx`.
- `detailGroups` (línea ~152) se arma con `aggregateByDimension(detailTxs, detailDimension, ...)`
  **sin** pasar por `aliasGroups`/`displayPersonaLabel`, a diferencia de `expenseGroupsView` e
  `incomeGroupsView` (líneas ~126-127) que sí aplican el apodo.
- El `DonutChart` de la línea ~255 recibe `detailGroups` crudo. La lista adyacente (líneas
  ~236-240) sí usa `displayPersonaLabel(person.key, person.holder, aliases)` vía `detailPersonas`.
- Resultado: con `detailDimension === 'persona'` y un apodo puesto, la lista muestra el apodo pero
  el tooltip/leyenda del donut muestra el nombre real — justo lo que MEJ-8 buscaba ocultar.

## Pasos
1. Cuando `detailDimension === 'persona'`, aplicar `aliasGroups` (o equivalente) a `detailGroups`
   antes de pasarlo al `DonutChart`, igual que ya se hace con `expenseGroupsView`.
2. Verificar que el resto de dimensiones (banco/medio/categoría) sigue sin verse afectado (el alias
   solo aplica a persona).
3. `typecheck` / `lint` / `test`.

## Criterios de aceptación
- [ ] Con un apodo configurado y "ver por" = persona, el donut de detalle muestra el mismo label
      que la lista de al lado (el apodo, no el nombre real).
- [ ] Las demás dimensiones del detalle no cambian.

## Fuera de alcance
- Cualquier otro refactor de `ReportsPage` (ver `REF-1`).

## Por qué este modelo
Sonnet: fix acotado de una línea de datos ya calculada, sin decisiones de diseño.
