import { describe, expect, it } from 'vitest';
import { buildRateIndex, lookupRate, resolveFxDate } from './fx';

describe('buildRateIndex / lookupRate', () => {
  it('usa la cotización vigente más reciente con fecha <= la buscada', () => {
    const index = buildRateIndex([
      { date: '2026-01-10', currency: 'USD', sell: 1000 },
      { date: '2026-02-10', currency: 'USD', sell: 1100 },
    ]);

    expect(lookupRate(index, 'USD', '2026-01-15')).toBe(1000);
    expect(lookupRate(index, 'USD', '2026-02-10')).toBe(1100);
    expect(lookupRate(index, 'USD', '2026-03-01')).toBe(1100);
  });

  it('sin cotización anterior o igual a la fecha buscada: undefined', () => {
    const index = buildRateIndex([{ date: '2026-02-10', currency: 'USD', sell: 1100 }]);
    expect(lookupRate(index, 'USD', '2026-01-01')).toBeUndefined();
  });

  it('moneda sin filas: undefined', () => {
    const index = buildRateIndex([{ date: '2026-02-10', currency: 'USD', sell: 1100 }]);
    expect(lookupRate(index, 'EUR', '2026-02-10')).toBeUndefined();
  });

  it('descarta filas con sell nulo', () => {
    const index = buildRateIndex([{ date: '2026-02-10', currency: 'USD', sell: null }]);
    expect(lookupRate(index, 'USD', '2026-02-10')).toBeUndefined();
  });
});

describe('resolveFxDate', () => {
  it('si el movimiento tiene charged_on, se usa tal cual sin mirar el medio', () => {
    const date = resolveFxDate(
      { occurredOn: '2026-01-05', chargedOn: '2026-01-20' },
      { type: 'credit', billingCloseDay: 10 },
    );
    expect(date).toBe('2026-01-20');
  });

  it('tarjeta de crédito sin charged_on: usa el cierre del ciclo que contiene occurred_on', () => {
    const date = resolveFxDate(
      { occurredOn: '2026-01-05', chargedOn: null },
      { type: 'credit', billingCloseDay: 10 },
    );
    expect(date).toBe('2026-01-10');
  });

  it('débito sin charged_on: usa occurred_on directo (conversión inmediata)', () => {
    const date = resolveFxDate(
      { occurredOn: '2026-01-05', chargedOn: null },
      { type: 'debit', billingCloseDay: null },
    );
    expect(date).toBe('2026-01-05');
  });

  it('sin medio (efectivo): usa occurred_on directo', () => {
    const date = resolveFxDate({ occurredOn: '2026-01-05', chargedOn: null }, null);
    expect(date).toBe('2026-01-05');
  });

  it('tarjeta de crédito sin billing_close_day configurado: usa occurred_on directo', () => {
    const date = resolveFxDate(
      { occurredOn: '2026-01-05', chargedOn: null },
      { type: 'credit', billingCloseDay: null },
    );
    expect(date).toBe('2026-01-05');
  });
});
