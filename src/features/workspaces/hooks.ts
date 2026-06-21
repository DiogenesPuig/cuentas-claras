import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { upsertMyProfile } from '@/features/auth';
import {
  acceptInvitation,
  createInvitation,
  createWorkspace,
  getMyRole,
  getWorkspace,
  listInvitations,
  listMembers,
  listMyWorkspaces,
  previewInvitation,
  removeMember,
  updateMemberRole,
  updateWorkspaceSettings,
  type Invitation,
  type InviteInput,
  type Member,
  type MemberRole,
  type Workspace,
  type WorkspaceSettingsInput,
} from './api';
import type { OnboardingInput } from './schema';

export const workspacesKeys = {
  mine: ['workspaces', 'mine'] as const,
  myRole: (workspaceId: string | undefined) => ['workspaces', 'myRole', workspaceId] as const,
  one: (workspaceId: string | undefined) => ['workspaces', 'one', workspaceId] as const,
  members: (workspaceId: string | undefined) => ['workspaces', 'members', workspaceId] as const,
  invitations: (workspaceId: string | undefined) =>
    ['workspaces', 'invitations', workspaceId] as const,
  invitationPreview: (token: string | undefined) =>
    ['workspaces', 'invitationPreview', token] as const,
};

/** Lista los workspaces del usuario. Sirve para decidir si mostrar el onboarding. */
export function useMyWorkspaces() {
  return useQuery({
    queryKey: workspacesKeys.mine,
    queryFn: listMyWorkspaces,
  });
}

/**
 * Completa el onboarding: asegura la fila en `profiles` (con el nombre elegido)
 * y crea el primer workspace, donde el usuario queda como owner.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<Workspace, Error, OnboardingInput>({
    mutationFn: async ({ displayName, workspaceName, baseCurrency }) => {
      await upsertMyProfile(displayName);
      return createWorkspace({ name: workspaceName, base_currency: baseCurrency });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.mine });
    },
  });
}

/** Rol del usuario en el workspace activo. Sirve para mostrar/ocultar acciones de owner/admin. */
export function useMyRole(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspacesKeys.myRole(workspaceId),
    queryFn: () => getMyRole(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

/** Datos del workspace activo (para `WorkspaceSettings`). */
export function useWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspacesKeys.one(workspaceId),
    queryFn: () => getWorkspace(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

/** Edita name/base_currency/fx_quote del workspace activo. */
export function useUpdateWorkspaceSettings(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Workspace, Error, WorkspaceSettingsInput>({
    mutationFn: (input) => updateWorkspaceSettings(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.one(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.mine });
    },
  });
}

/** Miembros del workspace activo, con nombre/avatar/rol (nunca el teléfono). */
export function useMembers(workspaceId: string | undefined) {
  return useQuery<Member[]>({
    queryKey: workspacesKeys.members(workspaceId),
    queryFn: () => listMembers(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

export function useUpdateMemberRole(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { memberId: string; role: MemberRole }>({
    mutationFn: ({ memberId, role }) => updateMemberRole(memberId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.members(workspaceId) });
    },
  });
}

export function useRemoveMember(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (memberId) => removeMember(memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.members(workspaceId) });
    },
  });
}

/** Invitaciones del workspace activo (para mostrar las pendientes con su link). */
export function useInvitations(workspaceId: string | undefined) {
  return useQuery<Invitation[]>({
    queryKey: workspacesKeys.invitations(workspaceId),
    queryFn: () => listInvitations(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

export function useCreateInvitation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Invitation, Error, InviteInput>({
    mutationFn: (input) => createInvitation(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.invitations(workspaceId) });
    },
  });
}

/** Vista previa de una invitación por token, para la pantalla `/invite/:token`. */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: workspacesKeys.invitationPreview(token),
    queryFn: () => previewInvitation(token as string),
    enabled: token !== undefined,
    retry: false,
  });
}

/** Acepta la invitación y refresca la lista de workspaces del usuario. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: (token) => acceptInvitation(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.mine });
    },
  });
}
