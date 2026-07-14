# src/features/workspaces/components

- `RequireWorkspace.tsx` — guard: si el usuario no tiene workspaces, redirige a `/onboarding`.
- `MemberList.tsx` — lista de miembros (nombre/avatar/rol, nunca el teléfono); owner/admin pueden
  cambiar el rol de los demás (`RoleSelect`) y quitarlos. El `owner` no se edita ni se quita desde
  acá (transferir ownership queda fuera de alcance). Cada miembro tiene un ✏️ para ponerle un
  **apodo privado** (MEJ-8, `features/aliases`; misma `personaKey` `member:<id>` que los reportes) y,
  para owner/admin, un `MemberAliasesEditor` con sus "otros nombres".
- `MemberAliasesEditor.tsx` — chips (agregar/quitar) con los **alias** de la persona (IDENT-1 paso 4,
  `updateMemberAliases`): nombres alternativos reales para reconocerla al importar transferencias
  (dato del grupo, distinto del apodo privado). Solo matching futuro; no fusiona movimientos.
- `PromotePlaceholder.tsx` — para una persona del grupo **sin cuenta** (placeholder), owner/admin
  genera un link de **promoción** (IDENT-1 paso 6, `createPlaceholderInvite`): al aceptarlo esa
  persona pasa a ser un usuario real conservando toda su historia. Muestra el link para copiar.
- `RoleSelect.tsx` — select de rol asignable (`admin`/`member`/`viewer`).
- `InviteForm.tsx` — form de invitación por email + rol (un solo uso).
- `InviteLink.tsx` — fila de una invitación con su link copiable (`/invite/:token`) y botón
  Revocar; distingue link genérico (sin email, reutilizable) de invitación por email. Sin envío de
  email real (fuera de alcance de C15).
- `InviteSection.tsx` — combina `InviteForm`, el generador de link genérico reutilizable
  (`RoleSelect` + "Generar link") y la lista de invitaciones pendientes; solo visible para
  owner/admin.
- `WorkspaceSettings.tsx` — form para editar name/base_currency/fx_quote del workspace activo.
- `DeleteWorkspace.tsx` — "Zona de peligro" (MEJ-15): elimina el grupo y todo lo colgado. Solo owner;
  confirmación fuerte (escribir el nombre exacto habilita el botón). Tras borrar reasigna el workspace
  activo a otro grupo (o lo limpia → onboarding).
- `CreateWorkspaceDialog.tsx` — modal para crear un grupo adicional (nombre + moneda); reusable en el
  `WorkspaceSwitcher` y en `/grupo`. Al crear, llama `onCreated(id)` (el caller lo activa).
