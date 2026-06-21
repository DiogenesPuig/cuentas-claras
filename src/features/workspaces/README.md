# src/features/workspaces

Pertenencia del usuario a workspaces, creación del primero (onboarding), gestión del grupo
(miembros/roles/invitaciones) y configuración del workspace. Implementa **FR-2**, **FR-3** y
**FR-4** (PRD §5.1).

## Archivos

- `api.ts` — Supabase: `listMyWorkspaces`, `createWorkspace`, `getMyRole`, `getWorkspace`,
  `updateWorkspaceSettings` (name/base_currency/fx_quote); `listMembers` (vía `member_directory`,
  nunca `profiles` directo: privacidad del teléfono), `updateMemberRole`, `removeMember`;
  `listInvitations`, `createInvitation`; `previewInvitation`/`acceptInvitation` (RPC a las
  funciones `SECURITY DEFINER` `invitation_preview`/`accept_invitation` — quien todavía no es
  miembro no puede leer `invitations` por RLS, así que el alta por token pasa por esas funciones).
  Sin React.
- `hooks.ts` — react-query equivalente a cada función de `api.ts` (`useMyWorkspaces`,
  `useCompleteOnboarding`, `useMyRole`, `useWorkspace`, `useUpdateWorkspaceSettings`,
  `useMembers`, `useUpdateMemberRole`, `useRemoveMember`, `useInvitations`,
  `useCreateInvitation`, `useInvitationPreview`, `useAcceptInvitation`).
- `schema.ts` — zod del onboarding, `BASE_CURRENCIES`; `ASSIGNABLE_ROLES`/`inviteSchema` (roles
  que se pueden otorgar desde la UI: nunca `owner`); `FX_QUOTES`/`workspaceSettingsSchema`.
- `index.ts` — barrel del feature.
- `components/` — ver su `README.md`.

## Relacionados

- La creación/actualización de la fila en `profiles` vive en `features/auth` (`upsertMyProfile`).
- `GroupPage` (`/grupo`) e `InviteAcceptPage` (`/invite/:token`) viven en `src/app/` (composición).
