# C15 Grupo: miembros, roles, invitaciones

**Sprint:** C · **Modelo sugerido:** Sonnet · **Depende de:** A5

## Objetivo
Gestión del workspace: ver/editar datos del grupo, listar miembros con sus roles e invitar gente por email o link.

## Contexto
- `db/schema_fase1.sql` → `workspace_members` (roles), `invitations` (token, expires_at), vista `member_directory` (solo nombre/avatar, sin teléfono).
- `PRD.md` §3 (roles), §5.1 (FR-3), §5.7 N/A. Privacidad: nunca mostrar el teléfono (solo nombre).
- `wireframes/wireframes_fase1.html` pantallas 7 y 8.

## Archivos a crear/editar
- `src/features/workspaces/` → ampliar `api.ts`/`hooks.ts`; `components/MemberList`, `RoleSelect`, `InviteForm`, `InviteLink`, `WorkspaceSettings`.
- `src/app/` → `GroupPage` (ruta `/grupo`).
- Aceptación de invitación: ruta `/invite/:token`.

## Pasos
1. `MemberList` usando la vista `member_directory` (nombre/avatar/rol) — **no** leer `profiles` directo (privacidad del teléfono).
2. Owner/admin: cambiar rol y quitar miembros.
3. `InviteForm`: email + rol → crea `invitations` (estado pending, token, vence 7 días). `InviteLink`: copiar link.
4. `/invite/:token`: validar token (no vencido/revocado) y crear `workspace_member` para el usuario logueado.
5. `WorkspaceSettings`: editar name, base_currency, fx_source/fx_quote.

## Criterios de aceptación
- [ ] La lista de miembros muestra nombre y rol, nunca el teléfono.
- [ ] Owner/admin invita (email + link), cambia roles y quita miembros; member no.
- [ ] Aceptar una invitación válida agrega al usuario como member; un token vencido/inválido se rechaza.
- [ ] Editar la config del workspace funciona y afecta la consolidación (moneda/cotización).
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Envío real de emails (puede quedar en link copiable si no hay proveedor configurado; si se quiere email, escalar para elegir proveedor).

## Tests
- Test de validación de invitación (token vencido/válido/revocado).

## Por qué este modelo
Sonnet: varias reglas de permisos y el flujo de invitación; importa respetar RLS y la privacidad del teléfono. La elección de proveedor de email se escala.
