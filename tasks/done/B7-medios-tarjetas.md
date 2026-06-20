# B7 Medios/tarjetas (lista plana + form, con extensiones)

**Sprint:** B · **Modelo sugerido:** Sonnet · **Depende de:** A5

## Objetivo
Gestionar tarjetas y medios de pago como **lista plana** (cada extensión es su propia fila), con su banco, red, holder y ciclo de cierre.

## Contexto
- `db/schema_fase1.sql` → `accounts` (`network`, `type`, `owner_member_id` nullable, `holder_name`, `is_extension`, `parent_account_id`, `billing_close_day`).
- `PRD.md` §5.2 (FR-5, FR-6, FR-6b, FR-6c, FR-6d), glosario "Titular/Extensión".
- `wireframes/wireframes_fase1.html` pantalla 5 (filas planas; extensión como fila propia).

## Archivos a crear/editar
- `src/features/accounts/` → `api.ts`, `hooks.ts`, `schema.ts`, `components/AccountList`, `components/AccountForm`.

## Pasos
1. `listAccounts(workspaceId)` (no archivadas por defecto) y total por medio en el período (puede sumarse luego con datos de transacciones).
2. `AccountForm`: name, bank, network (visa/master/…), type, currency, last4, holder (member o `holder_name`), `is_extension` (si on, elegir `parent_account_id`), `billing_close_day`.
3. `AccountList`: filas planas; si `is_extension`, mostrar "extensión" + banco + titular.
4. `useAccounts()` reutilizable para el alta de movimientos.

## Criterios de aceptación
- [ ] Se puede crear una tarjeta titular y una extensión que la referencia.
- [ ] La lista muestra cada medio como fila propia, con banco/red/holder y, si aplica, marca de extensión.
- [ ] `owner_member_id` se setea cuando el holder es un miembro; si no, queda `holder_name`.
- [ ] Solo owner/admin crea/edita (RLS lo refuerza).
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Cálculo del total por medio si depende de C11 (se puede dejar placeholder y conectarlo luego).

## Tests
- Smoke test del `AccountForm` (validaciones; coherencia is_extension ⇒ parent requerido).

## Por qué este modelo
Sonnet: el form tiene varias reglas (extensión⇒titular, holder miembro vs nombre) que conviene resolver bien; no es trivial pero está acotado.
