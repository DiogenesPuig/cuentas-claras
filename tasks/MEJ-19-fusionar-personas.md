# MEJ-19 Fusionar / vincular personas duplicadas

**Sprint:** Mejoras · **Modelo sugerido:** Opus (cierra el RPC/RLS) → Sonnet (UI) · **Depende de:** IDENT-1

## Objetivo
Poder **fusionar dos personas del grupo** en una, moviendo toda la historia de una a la otra y borrando
la duplicada. Cubre el caso de borde que IDENT-1 dejó afuera: una persona que **ya tenía un placeholder**
(con historia) **se une por un link genérico** → queda una cuenta real nueva y vacía, separada del
placeholder. Hoy no hay forma de unirlas de un click.

## Historia de usuario
> Como owner/admin, cuando veo dos "personas" que en realidad son la misma (un placeholder con historia +
> una cuenta real que se unió por link genérico, o dos placeholders), quiero **vincularlas en una sola**
> conservando todos los movimientos, medios, alias y apodos.

## Contexto (por qué existe)
- IDENT-1 paso 6 promueve un placeholder→cuenta **solo** vía invitación **dirigida** (`invitations.member_id`).
- Si la persona entra por un **link genérico** (`createInviteLink`), `accept_invitation` le crea una fila
  nueva → duplicado. El flujo manual actual (quitar la membresía nueva vacía + reenviar el link de
  promoción del placeholder) **solo sirve si la cuenta nueva no cargó movimientos todavía**.
- "Fusionar personas duplicadas" figura como **Fuera de alcance** en `IDENT-1`; este ticket lo implementa.

## Diseño (a cerrar)
- **RPC `merge_members(p_keep uuid, p_remove uuid)`** (SECURITY DEFINER), owner/admin del workspace:
  mueve del "remove" al "keep" todo lo que lo referencia y borra el "remove". Referencias a repuntar:
  - `transactions.owner_member_id`
  - `accounts.owner_member_id`
  - `persona_aliases` (`member:<remove>` → `member:<keep>`, deduplicando por `(user_id, workspace_id)`
    para no violar el unique; si el usuario ya tiene apodo para `keep`, se descarta el de `remove`)
  - `workspace_members.aliases`: unir los del "remove" en el "keep"
  - luego `delete from workspace_members where id = p_remove`.
- **Elección del sobreviviente:** si uno de los dos tiene cuenta (`user_id` no nulo) y el otro es
  placeholder, **conservar el que tiene cuenta** (o el que el admin elija). Validar que ambos son del
  **mismo workspace**; no permitir fusionar al `owner` como "remove".
- **RLS/seguridad:** exige owner/admin (como el resto de gestión de miembros); no debilita nada; la lógica
  vive en el RPC (portátil a Postgres pelado).
- **UI (`/grupo`):** acción "Vincular con otra persona / fusionar": elegís la otra persona (lista de
  miembros/placeholders del workspace) y confirmás con un aviso claro ("se moverán N movimientos; esto no
  se puede deshacer"). Mostrar un preview del conteo antes de confirmar.

## Pasos
1. **(Opus)** Cerrar el RPC (dirección de la fusión, validaciones, colisión de apodos) y la RLS.
2. Migración: `merge_members(...)` + grants (`authenticated`), revoke public.
3. `api.ts`: `mergeMembers(keepId, removeId)`; hook que invalida las listas de miembros/reportes.
4. UI en `MemberList`: selector + confirmación con conteo; solo owner/admin.
5. Tests: lógica de repunteo/colisión de apodos (idealmente parte pura testeable + verificación en local
   con una fusión real).

## Criterios de aceptación
- [ ] Owner/admin puede fusionar dos personas del mismo workspace en una, sin perder movimientos/medios/
      alias/apodos.
- [ ] El caso "placeholder con historia + cuenta nueva por link genérico" queda resuelto (incluso si la
      cuenta nueva ya tenía movimientos).
- [ ] No se puede fusionar entre workspaces ni eliminar al `owner`; RLS exige owner/admin.
- [ ] Confirmación clara e irreversible; tipos/schema al día; migración aplicada en remoto.

## Fuera de alcance
- Deshacer una fusión (es irreversible; se avisa).
- Detección automática de duplicados (esto es manual, lo decide el admin).
