# BUG-12 Editar un movimiento te lleva al tope de la página

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Editar un movimiento (o transferencia) no debería hacer scroll al tope ni perder el contexto de la
fila que estabas mirando. Debería poder editarse en el lugar, y modificar varios campos sin tener
que volver a bajar.

## Contexto (causa encontrada)
- Reportado por el usuario usando la app (2026-07-06).
- El form de edición se renderiza **arriba de todo** en `src/app/pages/TransactionsPage.tsx`
  (bloque `isFormOpen`, ~L162), **antes** de la búsqueda/filtros/lista. Al tocar "Editar" en una
  fila (que está más abajo), `setEditing(transaction)` abre el form arriba y además `TransactionForm`
  hace **foco automático en el monto** al montar (`amountRef.current?.focus()`), lo que scrollea el
  form a la vista → saltás al tope.

## Opciones
- **(a) Recomendada:** renderizar el form de edición como **modal/overlay** (mismo patrón de portal a
  `document.body` que se usó en BUG-11 para `CreateWorkspaceDialog`), así aparece centrado sin mover
  la página. Aplica también al alta.
- (b) Renderizar el form inline **debajo de la fila** que se edita (más cambio en la lista).
- (c) Mínimo: no hacer foco automático en edición y hacer `scrollIntoView` de la fila — pero el form
  sigue arriba, así que no resuelve del todo.

## Criterios de aceptación
- [ ] Al editar un movimiento desde la lista, no se pierde la posición de scroll / se edita en contexto.
- [ ] Se pueden cambiar varios campos sin volver a scrollear a la lista.
- [ ] El alta sigue funcionando igual (o mejora con el mismo patrón).

## Fuera de alcance
- Rediseño general de `/movimientos`.

## Por qué este modelo
Sonnet: cambio de presentación acotado (form → modal), reusando un patrón ya existente en el repo.
