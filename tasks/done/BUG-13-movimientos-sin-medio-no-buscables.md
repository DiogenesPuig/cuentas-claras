# BUG-13 No se pueden encontrar los movimientos sin medio en la lista

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Poder encontrar en `/movimientos` los movimientos que **no tienen medio asociado** (hoy quedan
"invisibles" a los filtros y hay que buscarlos a mano).

## Contexto (causa encontrada)
- Reportado por el usuario (2026-07-06).
- En `src/features/transactions/api.ts` (`listTransactions`):
  - El filtro por **persona** usa `accounts!inner` (`TRANSACTION_SELECT_INNER_ACCOUNT`, ~L43/L65):
    el `!inner` **excluye** los movimientos sin `account_id`. Así, cualquier vista/filtro por persona
    deja fuera los movimientos sin medio.
  - La **búsqueda** (`args.search`) solo hace `ilike` sobre `description` (~L66): un movimiento sin
    medio y sin descripción no aparece por ningún lado.
- Además, el `FilterBar` (medio) probablemente no ofrece una opción "Sin medio".

## Pasos / opciones
1. Agregar una opción **"Sin medio / Sin persona"** en el filtro de medio (o persona) que filtre por
   `account_id IS NULL`.
2. Evaluar ampliar la búsqueda de texto (hoy solo `description`).
3. Revisar que el filtro por persona no excluya silenciosamente los sin-medio (o dejar claro en la UI
   que "persona" implica tener medio).

## Criterios de aceptación
- [ ] Existe una forma de listar/filtrar los movimientos **sin medio** desde `/movimientos`.
- [ ] Los movimientos sin medio no desaparecen de la lista por el `!inner` cuando no se filtra por persona.

## Relación
- Se **alivia** bastante con el Grupo C (efectivo con dueño + persona sin cuenta): habría menos
  movimientos "sin persona". Pero conviene arreglar el filtro igual (es independiente).

## Fuera de alcance
- Rediseño de los filtros.

## Por qué este modelo
Sonnet: ajuste acotado de query + una opción de filtro, con criterio claro.
