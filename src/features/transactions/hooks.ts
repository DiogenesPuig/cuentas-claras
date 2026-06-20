import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  uploadAttachment,
  type Attachment,
  type Transaction,
  type TransactionInput,
  type TransactionView,
} from './api';

export const transactionsKeys = {
  list: (workspaceId: string | undefined) => ['transactions', workspaceId] as const,
};

/** Movimientos del workspace, más recientes primero (sin filtros, ver B10). */
export function useTransactions(workspaceId: string | undefined) {
  return useQuery<TransactionView[]>({
    queryKey: transactionsKeys.list(workspaceId),
    queryFn: () => listTransactions(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

export function useCreateTransaction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, TransactionInput>({
    mutationFn: (input) => createTransaction(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
    },
  });
}

export function useUpdateTransaction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, { id: string; input: TransactionInput }>({
    mutationFn: ({ id, input }) => updateTransaction(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
    },
  });
}

export function useDeleteTransaction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
    },
  });
}

/** Sube un comprobante y crea su fila en `attachments`. No invalida `transactions`. */
export function useUploadAttachment(workspaceId: string | undefined) {
  return useMutation<Attachment, Error, File>({
    mutationFn: (file) => uploadAttachment(workspaceId as string, file),
  });
}
