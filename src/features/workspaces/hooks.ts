import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { upsertMyProfile } from '@/features/auth';
import { createWorkspace, getMyRole, listMyWorkspaces, type Workspace } from './api';
import type { OnboardingInput } from './schema';

export const workspacesKeys = {
  mine: ['workspaces', 'mine'] as const,
  myRole: (workspaceId: string | undefined) => ['workspaces', 'myRole', workspaceId] as const,
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
