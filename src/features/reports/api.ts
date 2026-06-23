import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import type { FxRateRow } from '@/lib/fx';

export type ReportTransaction = Tables<'transactions'>;

export interface ReportAccount {
  name: string;
  bank: string | null;
  network: string | null;
  type: string;
  holder_name: string;
  owner_member_id: string | null;
  is_extension: boolean;
  parent_account_id: string | null;
  billing_close_day: number | null;
}

export interface ReportTransactionView extends ReportTransaction {
  account: ReportAccount | null;
  category: { name: string } | null;
}

export interface DateRange {
  /** Inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Exclusivo, `YYYY-MM-DD`. */
  to: string;
}

const REPORT_TRANSACTION_SELECT =
  '*, account:accounts(name,bank,network,type,holder_name,owner_member_id,is_extension,parent_account_id,billing_close_day), category:categories(name)';

/** Movimientos del workspace en `range` (por `occurred_on`), con lo necesario para agregar por dimensión y resolver FX. */
export async function listReportTransactions(
  workspaceId: string,
  range: DateRange,
): Promise<ReportTransactionView[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(REPORT_TRANSACTION_SELECT)
    .eq('workspace_id', workspaceId)
    .gte('occurred_on', range.from)
    .lt('occurred_on', range.to);
  if (error) throw error;
  return (data ?? []) as ReportTransactionView[];
}

export interface WorkspaceFxSettings {
  baseCurrency: string;
  fxSource: string;
  fxQuote: string;
}

/** Moneda base y fuente/cotización de FX elegidas por el workspace (C12). */
export async function getWorkspaceFxSettings(workspaceId: string): Promise<WorkspaceFxSettings> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('base_currency, fx_source, fx_quote')
    .eq('id', workspaceId)
    .single();
  if (error) throw error;
  return { baseCurrency: data.base_currency, fxSource: data.fx_source, fxQuote: data.fx_quote };
}

/**
 * Historial de cotizaciones (`fx_rates`, C12) de `currencies` hasta `upTo` inclusive,
 * para la fuente/cotización del workspace. Sirve para resolver el FX histórico de
 * cada movimiento (ver `lib/fx.ts`). Sin `currencies`, no consulta nada.
 */
export async function listFxRates(
  currencies: string[],
  fxSource: string,
  fxQuote: string,
  upTo: string,
): Promise<FxRateRow[]> {
  if (currencies.length === 0) return [];

  const { data, error } = await supabase
    .from('fx_rates')
    .select('date, currency, sell')
    .in('currency', currencies)
    .eq('source', fxSource)
    .eq('quote', fxQuote)
    .lte('date', upTo)
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
