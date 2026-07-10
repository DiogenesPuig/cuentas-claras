# src/features/workspaces

Pertenencia del usuario a workspaces, creación del primero (onboarding), gestión del grupo
(miembros/roles/invitaciones) y configuración del workspace. Implementa **FR-2**, **FR-3** y
**FR-4** (PRD §5.1).

## Archivos

- `api.ts` — Supabase: `listMyWorkspaces`, `createWorkspace`, `getMyRole`, `getWorkspace`,
  `updateWorkspaceSettings` (name/base_currency/fx_quote); `listMembers` (vía `member_directory`,
  nunca `profiles` directo: privacidad del teléfono; `Member` incluye `aliases`), `updateMemberRole`,
  `updateMemberAliases` (IDENT-1 paso 4: nombres alternativos de la persona para matchear titulares
  de transferencias; recorta/deduplica; RLS owner/admin), `removeMember`,
  `createPlaceholderMember` (IDENT-1: crea una "persona del grupo" sin cuenta —`user_id NULL` +
  nombre—; RLS owner/admin; no da acceso a nadie);
  `listInvitations`, `createInvitation` (por email, un solo uso), `createInviteLink` (link genérico
  reutilizable sin email, vence a 48 hs), `revokeInvitation`; `previewInvitation`/`acceptInvitation`
  (RPC a las funciones `SECURITY DEFINER` `invitation_preview`/`accept_invitation` — quien todavía
  no es miembro no puede leer `invitations` por RLS, así que el alta por token pasa por esas
  funciones; `accept_invitation` solo consume las de email, los links quedan reutilizables). Sin React.
- `hooks.ts` — react-query equivalente a cada función de `api.ts` (`useMyWorkspaces`,
  `useCompleteOnboarding`, `useMyRole`, `useWorkspace`, `useUpdateWorkspaceSettings`,
  `useMembers`, `useUpdateMemberRole`, `useUpdateMemberAliases` (IDENT-1 paso 4, invalida las dos
  listas de miembros porque los alias cambian el matching), `useRemoveMember`,
  `useCreatePlaceholderMember` (IDENT-1, invalida las dos listas de miembros), `useInvitations`,
  `useCreateInvitation`, `useCreateInviteLink`, `useRevokeInvitation`, `useInvitationPreview`,
  `useAcceptInvitation`, `useCreateWorkspace`).
- `schema.ts` — zod del onboarding, `BASE_CURRENCIES`; `ASSIGNABLE_ROLES`/`inviteSchema` (roles
  que se pueden otorgar desde la UI: nunca `owner`); `FX_QUOTES`/`workspaceSettingsSchema`.
- `index.ts` — barrel del feature.
- `components/` — ver su `README.md`.

## Relacionados

- La creación/actualización de la fila en `profiles` vive en `features/auth` (`upsertMyProfile`).
- `GroupPage` (`/grupo`) e `InviteAcceptPage` (`/invite/:token`) viven en `src/app/` (composición).
