import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  deleteTransaction,
  extractReceiptData,
  findDuplicateCandidates,
  getAttachment,
  getAttachmentUrl,
  listCategoryHistory,
  listTransactions,
  updateTransaction,
  uploadAttachment,
  type Attachment,
  type DuplicateCandidateView,
  type DuplicateCriteria,
  type ReceiptExtraction,
  type Transaction,
  type TransactionInput,
  type TransactionView,
} from './api';
import type { TransactionFilters } from './filters';
import type { CategoryHistoryRow } from '@/lib/category-learn';

export const transactionsKeys = {
  list: (workspaceId: string | undefined, filters: TransactionFilters = {}) =>
    ['transactions', workspaceId, filters] as const,
  categoryHistory: (workspaceId: string | undefined) =>
    ['transactions', 'category-history', workspaceId] as const,
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

/**
 * Historial para la memoria de categorías (MEJ-17/18). Cacheado aparte de la lista filtrada; se
 * refresca al crear/editar/borrar movimientos (esas mutaciones invalidan todo el key `transactions`).
 */
export function useCategoryHistory(workspaceId: string | undefined) {
  return useQuery<CategoryHistoryRow[]>({
    queryKey: transactionsKeys.categoryHistory(workspaceId),
    queryFn: () => listCategoryHistory(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

export function useCreateTransaction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, TransactionInput>({
    mutationFn: (input) => createTransaction(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.categoryHistory(workspaceId) });
    },
  });
}

export function useUpdateTransaction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, { id: string; input: TransactionInput }>({
    mutationFn: ({ id, input }) => updateTransaction(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.categoryHistory(workspaceId) });
    },
  });
}

export function useDeleteTransaction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.categoryHistory(workspaceId) });
    },
  });
}

/** Sube un comprobante y crea su fila en `attachments`. No invalida `transactions`. */
export function useUploadAttachment(workspaceId: string | undefined) {
  return useMutation<Attachment, Error, File>({
    mutationFn: (file) => uploadAttachment(workspaceId as string, file),
  });
}

/** Busca duplicados candidatos del alta en curso (F2-13). On-demand (al confirmar el alta). */
export function useFindDuplicateCandidates(workspaceId: string | undefined) {
  return useMutation<DuplicateCandidateView[], Error, DuplicateCriteria>({
    mutationFn: (criteria) => findDuplicateCandidates(workspaceId as string, criteria),
  });
}

/** OCR de un comprobante vía el micro de ingesta (FR-14). No escribe en la DB. */
export function useExtractReceipt() {
  return useMutation<ReceiptExtraction, Error, File>({
    mutationFn: (file) => extractReceiptData(file),
  });
}

export interface AttachmentUrlResult {
  url: string;
  fileType: string;
}

/**
 * Signed URL (+ `file_type`) de un comprobante, pedida on-demand (F2-7): solo corre cuando
 * `enabled` es true (al abrir el visor, no al render de la lista). React Query la cachea por
 * `attachmentId` hasta que la signed URL vence (5 min en el bucket); `staleTime` queda algo por
 * debajo para no servir una URL ya vencida desde caché.
 */
export function useAttachmentUrl(attachmentId: string | null, enabled: boolean) {
  return useQuery<AttachmentUrlResult, Error>({
    queryKey: ['attachment-url', attachmentId],
    queryFn: async () => {
      const attachment = await getAttachment(attachmentId as string);
      const url = await getAttachmentUrl(attachment.file_url);
      return { url, fileType: attachment.file_type };
    },
    enabled: enabled && attachmentId !== null,
    staleTime: 4 * 60 * 1000,
    retry: false,
  });
}
