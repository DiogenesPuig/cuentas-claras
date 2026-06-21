import { useQuery } from '@tanstack/react-query';
import {
  getWorkspaceFxSettings,
  listFxRates,
  listReportTransactions,
  type DateRange,
  type ReportTransactionView,
  type WorkspaceFxSettings,
} from './api';

export const reportsKeys = {
  fxSettings: (workspaceId: string | undefined) => ['reports', 'fxSettings', workspaceId] as const,
  transactions: (workspaceId: string | undefined, range: DateRange) =>
    ['reports', 'transactions', workspaceId, range] as const,
  fxRates: (currencies: string[], fxSource: string | undefined, fxQuote: string | undefined, upTo: string) =>
    ['reports', 'fxRates', currencies, fxSource, fxQuote, upTo] as const,
};

/** Moneda base y fuente/cotización de FX del workspace (C12), para consolidar los reportes. */
export function useWorkspaceFxSettings(workspaceId: string | undefined) {
  return useQuery<WorkspaceFxSettings>({
    queryKey: reportsKeys.fxSettings(workspaceId),
    queryFn: () => getWorkspaceFxSettings(workspaceId as string),
    enabled: workspaceId !== undefined,
  });
}

/** Movimientos del workspace en `range`, con los datos de medio/categoría que necesitan los reportes. */
export function useReportTransactions(workspaceId: string | undefined, range: DateRange) {
  return useQuery<ReportTransactionView[]>({
    queryKey: reportsKeys.transactions(workspaceId, range),
    queryFn: () => listReportTransactions(workspaceId as string, range),
    enabled: workspaceId !== undefined,
  });
}

/**
 * Historial de cotizaciones de `currencies` hasta `upTo`, para la fuente/cotización del
 * workspace. Sin `currencies` (todo en la moneda base) no dispara la query.
 */
export function useFxRates(
  currencies: string[],
  fxSource: string | undefined,
  fxQuote: string | undefined,
  upTo: string,
) {
  return useQuery({
    queryKey: reportsKeys.fxRates(currencies, fxSource, fxQuote, upTo),
    queryFn: () => listFxRates(currencies, fxSource as string, fxQuote as string, upTo),
    enabled: currencies.length > 0 && fxSource !== undefined && fxQuote !== undefined,
  });
}
