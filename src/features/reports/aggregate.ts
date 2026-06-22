import { consolidateHistorical, type ConsolidationResult, type RateLookup } from '@/lib/money';
import { resolveFxDate } from '@/lib/fx';
import type { ReportTransactionView } from './api';

export const REPORT_DIMENSIONS = ['categoria', 'persona', 'banco', 'red', 'medio'] as const;
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

export const REPORT_DIMENSION_LABELS: Record<ReportDimension, string> = {
  categoria: 'Categoría',
  persona: 'Persona',
  banco: 'Banco',
  red: 'Red',
  medio: 'Medio',
};

const NO_CATEGORY = 'Sin categoría';
const NO_ACCOUNT = 'Sin medio';

/** Clave de agrupación (FR-22) según la dimensión elegida. */
function dimensionKeyFor(dimension: ReportDimension, tx: ReportTransactionView): string {
  switch (dimension) {
    case 'categoria':
      return tx.category?.name ?? NO_CATEGORY;
    case 'persona':
      return tx.account?.holder_name ?? NO_ACCOUNT;
    case 'banco':
      return tx.account?.bank ?? NO_ACCOUNT;
    case 'red':
      return tx.account?.network ?? NO_ACCOUNT;
    case 'medio':
      return tx.account?.name ?? NO_ACCOUNT;
  }
}

/** Fecha de FX de un movimiento del reporte (ver `lib/fx.resolveFxDate`). */
function rateDateFor(tx: ReportTransactionView): string {
  return resolveFxDate(
    { occurredOn: tx.occurred_on, chargedOn: tx.charged_on },
    tx.account
      ? { type: tx.account.type, billingCloseDay: tx.account.billing_close_day }
      : null,
  );
}

/** Consolida un lote de movimientos del reporte, resolviendo la fecha de FX de cada uno. */
export function consolidateTransactions(
  transactions: ReportTransactionView[],
  base: string,
  rateFor: RateLookup,
): ConsolidationResult {
  return consolidateHistorical(
    transactions.map((tx) => ({
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      rateDate: rateDateFor(tx),
    })),
    base,
    rateFor,
  );
}

export interface DimensionGroup {
  key: string;
  consolidated: ConsolidationResult;
}

/**
 * Agrupa los movimientos por `dimension` y consolida cada grupo (FR-22), usando el FX
 * histórico de cada movimiento. Los grupos suman, entre todos, el total del período:
 * todo movimiento cae en exactamente un grupo (con "Sin categoría"/"Sin medio" de fallback).
 * Orden: por volumen total (ingreso + gasto) consolidado, de mayor a menor.
 */
export function aggregateByDimension(
  transactions: ReportTransactionView[],
  dimension: ReportDimension,
  base: string,
  rateFor: RateLookup,
): DimensionGroup[] {
  const byKey = new Map<string, ReportTransactionView[]>();
  for (const tx of transactions) {
    const key = dimensionKeyFor(dimension, tx);
    const group = byKey.get(key) ?? [];
    group.push(tx);
    byKey.set(key, group);
  }

  const groups: DimensionGroup[] = Array.from(byKey.entries()).map(([key, txs]) => ({
    key,
    consolidated: consolidateTransactions(txs, base, rateFor),
  }));

  return groups.sort(
    (a, b) =>
      b.consolidated.income + b.consolidated.expense - (a.consolidated.income + a.consolidated.expense),
  );
}

/** Filtros combinables del reporte (AND). `null`/ausente = sin filtrar esa dimensión. */
export interface ReportFilters {
  persona?: string | null;
  categoria?: string | null;
  medio?: string | null;
  banco?: string | null;
  red?: string | null;
}

/** Subconjunto de movimientos que cumple todos los filtros activos (FR-22). */
export function filterReportTransactions(
  transactions: ReportTransactionView[],
  filters: ReportFilters,
): ReportTransactionView[] {
  const active = (Object.entries(filters) as [ReportDimension, string | null | undefined][]).filter(
    ([, value]) => value,
  );
  if (active.length === 0) return transactions;
  return transactions.filter((tx) =>
    active.every(([dimension, value]) => dimensionKeyFor(dimension, tx) === value),
  );
}

/** Categoría dominante de una persona si supera este umbral de su gasto; si no, "Varios". */
const DOMINANT_THRESHOLD = 0.4;
const MIXED_LABEL = 'Varios';

export interface PersonaSpending {
  /** Persona (holder del medio usado). */
  holder: string;
  /** Gasto consolidado de la persona, en la moneda base. */
  expense: number;
  /** Fracción 0..1 del gasto total del período que aporta esta persona. */
  share: number;
  /** Categoría en la que más gastó (o null si no tiene categoría). */
  mainCategory: string | null;
  /** Etiqueta legible: la categoría dominante o "Varios" si ninguna supera el umbral. */
  mainLabel: string;
}

/**
 * Gasto por persona (FR-22): cuánto aporta cada holder al gasto total del período, su
 * participación (`share`) y en qué categoría gastó mayormente. Ordenado de mayor a menor
 * gasto. Solo considera gastos (no ingresos). Pensado para "p1 = 50% (mayormente en super)".
 */
export function personaSpending(
  transactions: ReportTransactionView[],
  base: string,
  rateFor: RateLookup,
): PersonaSpending[] {
  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const byHolder = aggregateByDimension(expenses, 'persona', base, rateFor);
  const totalExpense = byHolder.reduce((sum, group) => sum + group.consolidated.expense, 0);

  return byHolder
    .filter((group) => group.consolidated.expense > 0)
    .map((group) => {
      const holderTxs = expenses.filter((tx) => dimensionKeyFor('persona', tx) === group.key);
      const byCategory = aggregateByDimension(holderTxs, 'categoria', base, rateFor);
      const top = byCategory.find((c) => c.consolidated.expense > 0) ?? null;
      const holderExpense = group.consolidated.expense;
      const topShare = top ? top.consolidated.expense / holderExpense : 0;
      return {
        holder: group.key,
        expense: holderExpense,
        share: totalExpense > 0 ? holderExpense / totalExpense : 0,
        mainCategory: top?.key ?? null,
        mainLabel: top && topShare >= DOMINANT_THRESHOLD ? top.key : MIXED_LABEL,
      };
    });
}

export interface MonthlyTotal {
  /** `YYYY-MM`. */
  month: string;
  consolidated: ConsolidationResult;
}

/** Comparativa mes a mes (FR-24): un consolidado por cada mes de `months`, en orden. */
export function monthlySeries(
  transactions: ReportTransactionView[],
  months: string[],
  base: string,
  rateFor: RateLookup,
): MonthlyTotal[] {
  return months.map((month) => {
    const txs = transactions.filter((tx) => tx.occurred_on.startsWith(month));
    return { month, consolidated: consolidateTransactions(txs, base, rateFor) };
  });
}

export interface PersonaAccountInfo {
  accountName: string;
  isExtension: boolean;
  /** Holder de la tarjeta titular, si esta cuenta es una extensión que apunta a otra. */
  titularHolderName: string | null;
}

interface AccountForPersona {
  id: string;
  name: string;
  holder_name: string;
  is_extension: boolean;
  parent_account_id: string | null;
}

/**
 * Para la vista "por persona" (FR-22): por cada holder, sus medios, marcando cuáles son
 * extensiones y de qué titular (holder de la cuenta padre). Pura: recibe la lista completa
 * de medios del workspace (no solo los que aparecen en movimientos del período).
 */
export function personaAccounts(accounts: AccountForPersona[]): Map<string, PersonaAccountInfo[]> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const result = new Map<string, PersonaAccountInfo[]>();

  for (const account of accounts) {
    const titular = account.is_extension && account.parent_account_id
      ? byId.get(account.parent_account_id) ?? null
      : null;

    const list = result.get(account.holder_name) ?? [];
    list.push({
      accountName: account.name,
      isExtension: account.is_extension,
      titularHolderName: titular?.holder_name ?? null,
    });
    result.set(account.holder_name, list);
  }

  return result;
}
