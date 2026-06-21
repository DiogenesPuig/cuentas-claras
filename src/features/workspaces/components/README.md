# src/features/workspaces/components

- `RequireWorkspace.tsx` — guard: si el usuario no tiene workspaces, redirige a `/onboarding`.
- `MemberList.tsx` — lista de miembros (nombre/avatar/rol, nunca el teléfono); owner/admin pueden
  cambiar el rol de los demás (`RoleSelect`) y quitarlos. El `owner` no se edita ni se quita desde
  acá (transferir ownership queda fuera de alcance).
- `RoleSelect.tsx` — select de rol asignable (`admin`/`member`/`viewer`).
- `InviteForm.tsx` — form de invitación (email + rol).
- `InviteLink.tsx` — fila de una invitación con su link copiable (`/invite/:token`); sin envío de
  email real (fuera de alcance de C15).
- `InviteSection.tsx` — combina `InviteForm` + lista de invitaciones pendientes; solo visible para
  owner/admin.
- `WorkspaceSettings.tsx` — form para editar name/base_currency/fx_quote del workspace activo.
