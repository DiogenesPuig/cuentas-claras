import { describe, expect, it } from 'vitest';
import { consolidate } from './money';

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
  });

  it('sin movimientos: todos los totales en cero y byCurrency vacío', () => {
    expect(consolidate([], 'ARS', {})).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      byCurrency: {},
    });
  });
});
