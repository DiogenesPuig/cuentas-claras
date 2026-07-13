/**
 * Totales del set de movimientos ya filtrado, para mostrarlos arriba de la lista (MEJ-13).
 * Suma **por moneda** (sin FX: los montos de distintas monedas no se mezclan) y separa gastos de
 * ingresos. Pura y testeable: opera sobre una forma mínima, no conoce Supabase ni React.
 */

export interface SummableTransaction {
  type: 'expense' | 'income';
  amount: number;
  currency: string;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface TransactionTotals {
  expense: CurrencyTotal[];
  income: CurrencyTotal[];
}

function toSorted(byCurrency: Map<string, number>): CurrencyTotal[] {
  return [...byCurrency.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Suma los montos por moneda, separando `expense` de `income`. Conserva el signo (los reintegros son
 * montos negativos, ver 0008). Devuelve una lista por moneda ordenada alfabéticamente.
 */
export function sumByType(transactions: readonly SummableTransaction[]): TransactionTotals {
  const expense = new Map<string, number>();
  const income = new Map<string, number>();
  for (const tx of transactions) {
    const bucket = tx.type === 'income' ? income : expense;
    bucket.set(tx.currency, (bucket.get(tx.currency) ?? 0) + tx.amount);
  }
  return { expense: toSorted(expense), income: toSorted(income) };
}
