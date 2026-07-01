# BUG-7 Carrera en el alta lazy del medio 'transfer' puede asignar el titular equivocado

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

> **Nota (chequeo 2026-07-02):** hacer **junto con BUG-8 y BUG-9 en una sola rama/PR** — los
> tres tocan `TransactionForm.tsx` (7 y 8 el mismo efecto/matcher) y comparten tests; por
> separado generan conflictos de merge. Ver "Orden de resolución recomendado" en `tasks/README.md`.

## Objetivo
Si el titular detectado de una transferencia cambia mientras hay una creación de medio
`'transfer'` en curso para el titular anterior, el movimiento **no** debe terminar con el medio
del titular viejo asignado.

## Contexto
- Detectado en revisión REF-1 (2026-07-01), leyendo `src/features/transactions/components/
  TransactionForm.tsx` líneas ~201-218 (efecto de alta lazy de medio `'transfer'`, F2-11).
- El efecto guarda concurrencia con el estado local `creatingTransferAccount`, pero el
  `getOrCreateTransferAccount.mutateAsync(...).then(account => setValue('accountId', account.id))`
  cierra sobre el `ownerHolder`/`matchedMember` de ESE run. Si el titular cambia (ej. el usuario
  re-extrae otro comprobante) mientras la promesa anterior sigue pendiente, el nuevo run queda
  bloqueado por el flag `creatingTransferAccount` (línea 211); cuando la promesa vieja resuelve,
  hace `setValue('accountId', ...)` con la cuenta del titular **anterior**, pisando lo que
  correspondía al titular actual. Tampoco hay limpieza si el componente se desmonta antes de
  resolver.

## Pasos
1. Cancelar/ignorar el resultado de una creación en curso si `ownerHolder` (o `matchedMember?.id`)
   cambió antes de que resuelva (ej. guardar un token/ref del run y comparar al resolver, o usar un
   flag de "vigente" que se invalida en el cleanup del efecto).
2. Agregar cleanup del efecto para no llamar `setValue`/`setCreatingTransferAccount` si el
   componente se desmontó o el efecto se volvió a ejecutar.
3. `typecheck` / `lint` / `test` (ampliar `TransactionForm.test.tsx` con el caso de cambio rápido
   de titular).

## Criterios de aceptación
- [ ] Cambiar de titular mientras una creación anterior está en curso no asigna el medio del
      titular viejo al movimiento actual.
- [ ] El caso normal (un solo titular, sin cambios) sigue funcionando igual.

## Fuera de alcance
- BUG-8 (invariante "un medio por persona" cuando hay member match sin cuenta) — relacionado pero
  se resuelve aparte.

## Por qué este modelo
Sonnet: fix de manejo de estado/concurrencia en un efecto existente, acotado y con tests.
