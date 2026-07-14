# src/features/workspaces

Pertenencia del usuario a workspaces, creación del primero (onboarding), gestión del grupo
(miembros/roles/invitaciones) y configuración del workspace. Implementa **FR-2**, **FR-3** y
**FR-4** (PRD §5.1).

## Archivos

- `api.ts` — Supabase: `listMyWorkspaces`, `createWorkspace`, `getMyRole`, `getWorkspace`,
  `updateWorkspaceSettings` (name/base_currency/fx_quote); `listMembers` (vía `member_directory`,
  nunca `profiles` directo: privacidad del teléfono; `Member` incluye `aliases`), `deleteWorkspace`
  (MEJ-15: borra el grupo y todo lo colgado por cascada de la DB; RLS `ws_delete` exige **owner**;
  los archivos de Storage quedan huérfanos, fuera de alcance v1), `updateMemberRole`,
  `updateMemberAliases` (IDENT-1 paso 4: nombres alternativos de la persona para matchear titulares
  de transferencias; recorta/deduplica; RLS owner/admin), `removeMember`,
  `createPlaceholderMember` (IDENT-1: crea una "persona del grupo" sin cuenta —`user_id NULL` +
  nombre—; RLS owner/admin; no da acceso a nadie);
  `listInvitations`, `createInvitation` (por email, un solo uso), `createInviteLink` (link genérico
  reutilizable sin email, vence a 48 hs), `createPlaceholderInvite` (IDENT-1 paso 6: link de
  **promoción** dirigido a un placeholder —`member_id`—; al aceptarlo esa persona toma esa identidad
  conservando su historia; un solo uso), `revokeInvitation`; `previewInvitation`/`acceptInvitation`
  (RPC a las funciones `SECURITY DEFINER` `invitation_preview`/`accept_invitation` — quien todavía
  no es miembro no puede leer `invitations` por RLS, así que el alta por token pasa por esas
  funciones; `accept_invitation` solo consume las de email/dirigidas, los links genéricos quedan
  reutilizables; si la invitación apunta a un placeholder vigente, **setea `user_id`** en esa fila en
  vez de crear un miembro nuevo). `InvitationPreview` incluye `memberName` (placeholder destino, o
  `null`). Sin React.
- `hooks.ts` — react-query equivalente a cada función de `api.ts` (`useMyWorkspaces`,
  `useCompleteOnboarding`, `useMyRole`, `useWorkspace`, `useUpdateWorkspaceSettings`,
  `useDeleteWorkspace` (MEJ-15, invalida la lista de grupos),
  `useMembers`, `useUpdateMemberRole`, `useUpdateMemberAliases` (IDENT-1 paso 4, invalida las dos
  listas de miembros porque los alias cambian el matching), `useRemoveMember`,
  `useCreatePlaceholderMember` (IDENT-1, invalida las dos listas de miembros), `useInvitations`,
  `useCreateInvitation`, `useCreateInviteLink`, `useCreatePlaceholderInvite` (IDENT-1 paso 6),
  `useRevokeInvitation`, `useInvitationPreview`, `useAcceptInvitation`, `useCreateWorkspace`).
- `schema.ts` — zod del onboarding, `BASE_CURRENCIES`; `ASSIGNABLE_ROLES`/`inviteSchema` (roles
  que se pueden otorgar desde la UI: nunca `owner`); `FX_QUOTES`/`workspaceSettingsSchema`.
- `index.ts` — barrel del feature.
- `components/` — ver su `README.md`.

## Relacionados

- La creación/actualización de la fila en `profiles` vive en `features/auth` (`upsertMyProfile`).
- `GroupPage` (`/grupo`) e `InviteAcceptPage` (`/invite/:token`) viven en `src/app/` (composición).
