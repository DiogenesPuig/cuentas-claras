# BUG-9 Falta guard anti doble-submit en TransactionForm / StatementImport

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

> **Nota (chequeo 2026-07-02):** conviene hacerlo **en la misma rama/PR que BUG-7 y BUG-8**
> (comparte `TransactionForm.tsx` y sus tests; es ortogonal pero evita conflictos de merge).
> Ver "Orden de resolución recomendado" en `tasks/README.md`.

## Objetivo
Un doble click rápido (o Enter repetido) antes de que React refleje el estado "deshabilitado"
no debe poder disparar dos altas/importaciones concurrentes para la misma acción.

## Contexto
- Detectado en revisión REF-1 (2026-07-01).
- `src/features/transactions/components/TransactionForm.tsx`: el botón de submit solo se
  deshabilita vía `disabled={isSubmitting || checkingDuplicates}` (prop que viene de afuera);
  `handleFormSubmit` no tiene un guard de re-entrancia propio.
- `src/features/imports/components/StatementImport.tsx`: mismo patrón en `handleParse`/
  `handleConfirm`, deshabilitados solo por `mutation.isPending`.
- En ambos casos, entre el click y el re-render que aplica `disabled`, un segundo click/Enter
  puede iniciar un segundo submit/parse antes de que el primero se refleje en el DOM.

## Pasos
1. Agregar un guard local (ej. `useRef` con flag "en curso") al inicio de `handleFormSubmit`
   (`TransactionForm`) y de `handleParse`/`handleConfirm` (`StatementImport`) que ignore llamadas
   mientras la anterior no terminó, además del `disabled` existente (defensa en profundidad, no
   reemplazo).
2. No cambiar el comportamiento visible en el caso normal (un solo submit).
3. `typecheck` / `lint` / `test` (agregar caso: invocar el handler dos veces seguidas de forma
   sincrónica y verificar que el callback de guardado/parseo se llama una sola vez).

## Criterios de aceptación
- [ ] Invocar el submit/parse dos veces seguidas antes de que se refleje `disabled` no dispara
      dos altas/importaciones.
- [ ] El flujo normal (un solo submit) no cambia.

## Fuera de alcance
- Deduplicación a nivel servidor/DB (ya existe detección de duplicados F2-13, que es otra cosa:
  esto es sobre reentrancia del propio handler, no sobre datos ya guardados).

## Por qué este modelo
Sonnet: guard de re-entrancia acotado en dos handlers existentes, con tests.
