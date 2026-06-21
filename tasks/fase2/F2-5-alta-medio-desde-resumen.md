# F2-5 Alta de medio desde el resumen

**Sprint:** Fase 2 · **Modelo sugerido:** Opus (criterio de match) → Sonnet (ejecuta) · **Depende de:** F2-3, B7

## Objetivo
Al parsear un resumen, identificar la **tarjeta/medio** al que pertenece (banco + red + últimos 4 + titular). Si coincide con un medio existente, asociar los movimientos a ese medio; si no existe, ofrecer **crearlo desde la misma pantalla de staging** con los datos detectados precargados. Motivación (PRD): muchos usuarios usarán la app solo subiendo el resumen, sin dar de alta sus medios a mano.

## Contexto (links a docs)
- PRD §5.4 FR-16b y §5.2 (medios, extensiones FR-6c). `tasks/fase2/PLAN.md` §4.
- Ya existe `accounts.last4`, `bank`, `network`, `holder_name`, `is_extension`, `parent_account_id`.
- El micro (F2-3) devuelve `account_hint: { bank, network, last4, holder }`.

## DECISIÓN PENDIENTE
- **Criterio de match** contra `accounts` del workspace. Recomendado: match fuerte por `(network, last4)` + `bank`; `holder` para desambiguar titular vs extensión. Definir qué pasa si hay match parcial (ej. mismo last4, banco distinto) → pedir confirmación.
- **Extensiones:** un resumen puede mezclar titular + extensiones; el alta debe poder crear cada extensión como medio propio apuntando a la titular (FR-6c).

## Archivos a crear/editar
- `src/lib/account-match.ts` (nuevo, puro y testeado): match de `account_hint` contra una lista de `accounts`.
- `src/features/imports/` → integrar el match y, si no hay medio, el alta inline (reusar el form/lógica de B7).
- `src/features/accounts/` si hace falta exponer un creador reutilizable.

## Pasos
1. `account-match.ts`: dado `account_hint` + `accounts[]`, devolver match exacto / candidatos / ninguno.
2. En el staging: si hay match, mostrar el medio y asociar; si no, CTA "Crear este medio" precargando banco/red/last4/holder.
3. Soportar crear extensiones (marcar `is_extension` + `parent_account_id`).
4. Una vez resuelto el medio, asociarlo a las filas del lote.

## Criterios de aceptación
- [ ] Un resumen de un medio ya cargado asocia los movimientos a ese medio (sin crear duplicado).
- [ ] Un resumen de un medio nuevo ofrece crearlo precargado; al confirmarlo, las filas quedan asociadas.
- [ ] Se puede dar de alta una extensión como medio propio ligada a su titular.
- [ ] `lib/account-match.ts` testeado; `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- El parseo (F2-3), dedupe (F2-4), categorías (F2-6).

## Tests
- `account-match.test.ts`: match exacto, candidatos por last4, sin match, titular vs extensión.

## Por qué este modelo
Opus define el criterio de match (afecta correctitud y UX del alta); Sonnet implementa la integración con el form de B7.
