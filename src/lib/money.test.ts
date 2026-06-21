import { describe, expect, it } from 'vitest';
import { consolidate, consolidateHistorical } from './money';

describe('consolidate', () => {
  it('solo movimientos en la moneda base: el consolidado es la suma directa', () => {
    const result = consolidate(
      [
        { amount: 1000, currency: 'ARS', type: 'income' },
        { amount: 400, currency: 'ARS', type: 'expense' },
      ],
      'ARS',
      {},
    );

    expect(result).toEqual({
      income: 1000,
      expense: 400,
      balance: 600,
      byCurrency: {
        ARS: { income: 1000, expense: 400, balance: 600 },
      },
      missingRates: [],
    });
  });

  it('base + otra moneda con cotización: convierte y suma al consolidado', () => {
    const result = consolidate(
      [
        { amount: 1000, currency: 'ARS', type: 'expense' },
        { amount: 10, currency: 'USD', type: 'expense' },
      ],
      'ARS',
      { USD: 1100 },
    );

    expect(result.expense).toBe(1000 + 10 * 1100);
    expect(result.income).toBe(0);
    expect(result.byCurrency).toEqual({
      ARS: { income: 0, expense: 1000, balance: -1000 },
      USD: { income: 0, expense: 10, balance: -10 },
    });
  });

  it('varias monedas distintas de la base, todas con cotización', () => {
    const result = consolidate(
      [
        { amount: 10, currency: 'USD', type: 'income' },
        { amount: 5, currency: 'EUR', type: 'expense' },
      ],
      'ARS',
      { USD: 1100, EUR: 1200 },
    );

    expect(result.income).toBe(10 * 1100);
    expect(result.expense).toBe(5 * 1200);
    expect(result.balance).toBe(10 * 1100 - 5 * 1200);
  });

  it('moneda sin cotización: se excluye del consolidado en base pero se ve en byCurrency', () => {
    const result = consolidate(
      [
        { amount: 1000, currency: 'ARS', type: 'income' },
        { amount: 50, currency: 'BRL', type: 'income' },
      ],
      'ARS',
      {},
    );

    expect(result.income).toBe(1000);
    expect(result.byCurrency.BRL).toEqual({ income: 50, expense: 0, balance: 50 });
    expect(result.missingRates).toEqual(['BRL']);
  });

  it('reporta cada moneda sin cotización una sola vez, ordenadas', () => {
    const result = consolidate(
      [
        { amount: 1, currency: 'BRL', type: 'expense' },
        { amount: 2, currency: 'BRL', type: 'expense' },
        { amount: 3, currency: 'CLP', type: 'expense' },
        { amount: 4, currency: 'USD', type: 'expense' },
      ],
      'ARS',
      { USD: 1100 },
    );

    expect(result.missingRates).toEqual(['BRL', 'CLP']);
  });

  it('sin movimientos: todos los totales en cero y byCurrency vacío', () => {
    expect(consolidate([], 'ARS', {})).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      byCurrency: {},
      missingRates: [],
    });
  });
});

describe('consolidateHistorical', () => {
  it('cada movimiento usa la cotización de su propia fecha, no una sola global', () => {
    const rates: Record<string, Record<string, number>> = {
      '2026-01-10': { USD: 1000 },
      '2026-02-10': { USD: 1100 },
    };
    const rateFor = (currency: string, date: string) => rates[date]?.[currency];

    const result = consolidateHistorical(
      [
        { amount: 10, currency: 'USD', type: 'expense', rateDate: '2026-01-10' },
        { amount: 10, currency: 'USD', type: 'expense', rateDate: '2026-02-10' },
      ],
      'ARS',
      rateFor,
    );

    expect(result.expense).toBe(10 * 1000 + 10 * 1100);
    expect(result.byCurrency.USD).toEqual({ income: 0, expense: 20, balance: -20 });
  });

  it('moneda base: no consulta rateFor, usa el monto directo', () => {
    const rateFor = (): number | undefined => {
      throw new Error('no debería llamarse para la moneda base');
    };

    const result = consolidateHistorical(
      [{ amount: 500, currency: 'ARS', type: 'income', rateDate: '2026-01-10' }],
      'ARS',
      rateFor,
    );

    expect(result.income).toBe(500);
  });

  it('sin cotización para esa fecha: se excluye del consolidado pero se ve en byCurrency', () => {
    const result = consolidateHistorical(
      [{ amount: 10, currency: 'USD', type: 'expense', rateDate: '2026-01-10' }],
      'ARS',
      () => undefined,
    );

    expect(result.expense).toBe(0);
    expect(result.byCurrency.USD).toEqual({ income: 0, expense: 10, balance: -10 });
    expect(result.missingRates).toEqual(['USD']);
  });
});
