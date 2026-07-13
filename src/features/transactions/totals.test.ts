import { describe, expect, it } from 'vitest';
import { sumByType, type SummableTransaction } from './totals';

const txs: SummableTransaction[] = [
  { type: 'expense', amount: 100, currency: 'ARS' },
  { type: 'expense', amount: 50, currency: 'ARS' },
  { type: 'expense', amount: 20, currency: 'USD' },
  { type: 'income', amount: 300, currency: 'ARS' },
  { type: 'expense', amount: -30, currency: 'ARS' }, // reintegro (monto negativo)
];

describe('sumByType', () => {
  it('suma por moneda separando gastos de ingresos', () => {
    const totals = sumByType(txs);
    expect(totals.expense).toEqual([
      { currency: 'ARS', total: 120 }, // 100 + 50 - 30
      { currency: 'USD', total: 20 },
    ]);
    expect(totals.income).toEqual([{ currency: 'ARS', total: 300 }]);
  });

  it('ordena las monedas alfabéticamente', () => {
    const totals = sumByType([
      { type: 'expense', amount: 1, currency: 'USD' },
      { type: 'expense', amount: 1, currency: 'ARS' },
      { type: 'expense', amount: 1, currency: 'EUR' },
    ]);
    expect(totals.expense.map((c) => c.currency)).toEqual(['ARS', 'EUR', 'USD']);
  });

  it('set vacío → sin totales', () => {
    expect(sumByType([])).toEqual({ expense: [], income: [] });
  });
});
