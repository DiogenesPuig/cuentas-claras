/** Tipo de movimiento, igual al enum `transaction_type` del esquema. */
export type TransactionType = 'income' | 'expense';

/** Entrada mínima que necesita `consolidate` (no requiere el registro completo). */
export interface ConsolidationInput {
  amount: number;
  currency: string;
  type: TransactionType;
}

/** Totales de una moneda, en su propia unidad (sin convertir). */
export interface CurrencyTotals {
  income: number;
  expense: number;
  balance: number;
}

export interface ConsolidationResult {
  /** Total de ingresos consolidado en `base`. */
  income: number;
  /** Total de gastos consolidado en `base`. */
  expense: number;
  /** `income - expense`, consolidado en `base`. */
  balance: number;
  /** Totales por moneda original (FR-9b), sin convertir. */
  byCurrency: Record<string, CurrencyTotals>;
}

/**
 * Suma ingresos/gastos por moneda original (`byCurrency`) y calcula el consolidado
 * en `base` (FR-9b): `monto` si la moneda ya es `base`, o `monto × rates[moneda]` si hay
 * cotización. Si una moneda distinta de `base` no tiene cotización en `rates`, sus
 * movimientos quedan afuera del consolidado pero siguen apareciendo en `byCurrency`.
 */
export function consolidate(
  txs: ConsolidationInput[],
  base: string,
  rates: Record<string, number>,
): ConsolidationResult {
  const byCurrency: Record<string, CurrencyTotals> = {};
  let income = 0;
  let expense = 0;

  for (const tx of txs) {
    const totals = byCurrency[tx.currency] ?? { income: 0, expense: 0, balance: 0 };
    if (tx.type === 'income') {
      totals.income += tx.amount;
      totals.balance += tx.amount;
    } else {
      totals.expense += tx.amount;
      totals.balance -= tx.amount;
    }
    byCurrency[tx.currency] = totals;

    const rate = tx.currency === base ? 1 : rates[tx.currency];
    if (rate === undefined) continue;
    const amountInBase = tx.amount * rate;

    if (tx.type === 'income') income += amountInBase;
    else expense += amountInBase;
  }

  return { income, expense, balance: income - expense, byCurrency };
}
