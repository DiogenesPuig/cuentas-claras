import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  deleteTransaction,
  extractReceiptData,
  listTransactions,
  updateTransaction,
  uploadAttachment,
  type Attachment,
  type ReceiptExtraction,
  type Transaction,
  type TransactionInput,
  type TransactionView,
} from './api';
import type { TransactionFilters } from './filters';

export const transactionsKeys = {
  list: (workspaceId: string | undefined, filters: TransactionFilters = {}) =>
    ['transactions', workspaceId, filters] as const,
};

/**
 * Movimientos del workspace, más recientes primero, acotados por `filters` (mes, medio,
 * categoría, moneda, persona y texto — FR-11). Sin filtros trae todo el workspace.
 */
export function useTransactions(workspaceId: string | undefined, filters: TransactionFilters = {}) {
  return useQuery<TransactionView[]>({
    queryKey: transactionsKeys.list(workspaceId, filters),
    queryFn: () => listTransactions(workspaceId as string, filters),
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

/** OCR de un comprobante vía el micro de ingesta (FR-14). No escribe en la DB. */
export function useExtractReceipt() {
  return useMutation<ReceiptExtraction, Error, File>({
    mutationFn: (file) => extractReceiptData(file),
  });
}
