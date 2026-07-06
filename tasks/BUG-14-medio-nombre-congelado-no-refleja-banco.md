# BUG-14 Editar el banco de un medio no se refleja en su nombre mostrado

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Si edito un medio y le agrego/cambio el banco, el cambio debe verse en todos lados donde se muestra
el medio (lista de movimientos, filtros, "recientes", lista de Medios), no solo en el combo del alta.

## Contexto (causa encontrada)
- Reportado por el usuario (2026-07-06): editó medios de un resumen de Banco Nación que no reconoció
  el banco; el banco se guarda, pero el medio sigue mostrándose como "red + ••últimos4" sin el banco.
- El **banco sí se persiste** (`toRow`/`updateAccount` incluyen `bank`; `useUpdateAccount` invalida).
  El problema es el **nombre**: al crear un medio desde un resumen (F2-5,
  `accountDefaultsFromHint`), el `name` se autogenera de `banco · red · ••last4`. Si el banco no se
  reconoció, quedó como "mastercard ••1234" (red + 4num). Editar el campo **banco** NO regenera el
  `name`.
- Dos formas de mostrar un medio:
  - Combo del alta → `accountLabel(...)` (dinámico: banco·red·••last4·(dueño)) → **sí** reflejaría el
    banco nuevo.
  - Lista de movimientos / filtro / recientes / lista de Medios → muestran `account.name` **crudo**
    (`TransactionRow.tsx`, `RecentTransactions.tsx`, `FilterBar.tsx`, `AccountList.tsx`) → siguen con
    el nombre viejo.

## Opciones
- **(a) Recomendada:** usar `accountLabel` (dinámico) en vez de `account.name` crudo en la lista de
  movimientos, el filtro, recientes y la lista de Medios. Así banco/red/últimos4 siempre reflejan lo
  editado. Trade-off: para tarjetas ignora el `name` custom (pero para las creadas de resumen el name
  ES ese string compuesto, así que es estrictamente mejor).
- (b) Regenerar el `name` al editar banco/red/last4 si todavía matchea el patrón autogenerado.
- (c) Dejar más claro en el `AccountForm` que el "nombre" es editable aparte del banco.

## Criterios de aceptación
- [ ] Editar el banco de un medio se ve reflejado en la lista de movimientos y en la lista de Medios.
- [ ] No rompe la distinción titular/extensión ni el caso efectivo/transfer (que caen al `name`).

## Relación
- Aunque se arregle el parser de BNA (F2-14), este problema queda para los medios ya creados mal → se
  arregla aparte.

## Por qué este modelo
Sonnet: cambio acotado de qué string se muestra (usar helper existente `accountLabel`), sin lógica nueva.
