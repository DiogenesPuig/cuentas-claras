import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAlias, listAliases, upsertAlias } from './api';
import type { AliasMap } from './display';

export const aliasesKeys = {
  list: (workspaceId: string | undefined) => ['aliases', workspaceId] as const,
};

/** Apodos del usuario en el workspace activo (MEJ-8). */
export function useAliases(workspaceId: string | undefined) {
  return useQuery<AliasMap>({
    queryKey: aliasesKeys.list(workspaceId),
    queryFn: () => listAliases(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

export function useUpsertAlias(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { personaKey: string; alias: string }>({
    mutationFn: ({ personaKey, alias }) => upsertAlias(workspaceId as string, personaKey, alias),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aliasesKeys.list(workspaceId) });
    },
  });
}

export function useDeleteAlias(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (personaKey) => deleteAlias(workspaceId as string, personaKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aliasesKeys.list(workspaceId) });
    },
  });
}
