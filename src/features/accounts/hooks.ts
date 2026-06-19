import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAccount,
  listAccounts,
  listMembersForHolder,
  updateAccount,
  type Account,
  type AccountInput,
  type MemberOption,
} from './api';

export const accountsKeys = {
  list: (workspaceId: string | undefined) => ['accounts', workspaceId] as const,
  members: (workspaceId: string | undefined) => ['accounts', 'members', workspaceId] as const,
};

/** Medios/tarjetas no archivados del workspace. Reutilizable para el alta de movimientos (B8). */
export function useAccounts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: accountsKeys.list(workspaceId),
    queryFn: () => listAccounts(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

/** Miembros del workspace, para el selector de holder del form. */
export function useMembersForHolder(workspaceId: string | undefined) {
  return useQuery<MemberOption[]>({
    queryKey: accountsKeys.members(workspaceId),
    queryFn: () => listMembersForHolder(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

export function useCreateAccount(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Account, Error, AccountInput>({
    mutationFn: (input) => createAccount(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsKeys.list(workspaceId) });
    },
  });
}

export function useUpdateAccount(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Account, Error, { id: string; input: AccountInput }>({
    mutationFn: ({ id, input }) => updateAccount(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsKeys.list(workspaceId) });
    },
  });
}
