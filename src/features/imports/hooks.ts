import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsKeys } from '@/features/transactions';
import {
  confirmStatementImport,
  parseStatementFile,
  type ImportRowInput,
  type StatementParse,
} from './api';

/** Parsea un resumen (PDF) en el micro. No escribe en la DB. */
export function useParseStatement() {
  return useMutation<StatementParse, Error, { file: File; password?: string }>({
    mutationFn: ({ file, password }) => parseStatementFile(file, password),
  });
}

/** Crea en bloque los movimientos confirmados desde el staging. */
export function useConfirmImport(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<
    number,
    Error,
    { file: File; rows: ImportRowInput[]; chargedOn: string | null }
  >({
    mutationFn: ({ file, rows, chargedOn }) =>
      confirmStatementImport(workspaceId as string, file, rows, chargedOn),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsKeys.list(workspaceId) });
    },
  });
}
