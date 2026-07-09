import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAccount,
  getOrCreateTransferAccount,
  getOrCreateSharedTransferAccount,
  listAccounts,
  listMembersForHolder,
  updateAccount,
  updateHolderAliases,
  type Account,
  type AccountInput,
  type MemberOption,
  type TransferAccountHolder,
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

/** Actualiza los alias de titular de un medio `'transfer'` (MEJ-4). */
export function useUpdateHolderAliases(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Account, Error, { id: string; aliases: string[] }>({
    mutationFn: ({ id, aliases }) => updateHolderAliases(id, aliases),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsKeys.list(workspaceId) });
    },
  });
}

/** Busca/crea (lazy) el medio `'transfer'` de una persona, para el alta de transferencias (F2-11). */
export function useGetOrCreateTransferAccount(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Account, Error, TransferAccountHolder>({
    mutationFn: (holder) => getOrCreateTransferAccount(workspaceId as string, holder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsKeys.list(workspaceId) });
    },
  });
}

/** Busca/crea (lazy) el medio "Transferencia" **compartido** del workspace (IDENT-1). */
export function useGetOrCreateSharedTransferAccount(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Account, Error, void>({
    mutationFn: () => getOrCreateSharedTransferAccount(workspaceId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountsKeys.list(workspaceId) });
    },
  });
}
