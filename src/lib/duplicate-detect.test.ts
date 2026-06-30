import { describe, expect, it } from 'vitest';
import {
  findDuplicates,
  SIMILAR_DATE_WINDOW_DAYS,
  type DuplicateInput,
  type ExistingTransaction,
} from './duplicate-detect';

function input(overrides: Partial<DuplicateInput> = {}): DuplicateInput {
  return {
    amount: 1000,
    currency: 'ARS',
    occurredOn: '2026-06-15',
    accountId: null,
    description: null,
    contentHash: null,
    ...overrides,
  };
}

function tx(overrides: Partial<ExistingTransaction> = {}): ExistingTransaction {
  return {
    amount: 1000,
    currency: 'ARS',
    occurred_on: '2026-06-15',
    account_id: null,
    description: null,
    attachmentContentHash: null,
    ...overrides,
  };
}

describe('findDuplicates', () => {
  it('mismo archivo (hash) → same-file, aunque monto/fecha difieran', () => {
    const existing = [tx({ amount: 999, occurred_on: '2026-01-01', attachmentContentHash: 'abc' })];
    const res = findDuplicates(input({ amount: 1, contentHash: 'abc' }), existing);
    expect(res).toHaveLength(1);
    expect(res[0].reason).toBe('same-file');
  });

  it('mismo monto+moneda y fecha dentro de la ventana → amount-date', () => {
    const existing = [tx({ occurred_on: '2026-06-17' })]; // +2 días
    const res = findDuplicates(input(), existing);
    expect(res).toHaveLength(1);
    expect(res[0].reason).toBe('amount-date');
  });

  it('fuera de la ventana de fecha no matchea', () => {
    const existing = [tx({ occurred_on: '2026-06-18' })]; // +3 días
    expect(findDuplicates(input(), existing)).toHaveLength(0);
  });

  it('distinta moneda o distinto monto no matchea', () => {
    expect(findDuplicates(input(), [tx({ currency: 'USD' })])).toHaveLength(0);
    expect(findDuplicates(input(), [tx({ amount: 1000.5 })])).toHaveLength(0);
  });

  it('refuerza con el medio (amount-date-account)', () => {
    const existing = [tx({ account_id: 'acc-1' })];
    const res = findDuplicates(input({ accountId: 'acc-1' }), existing);
    expect(res[0].reason).toBe('amount-date-account');
  });

  it('refuerza con la descripción normalizada (amount-date-desc)', () => {
    const existing = [tx({ description: 'CAFÉ  Martinez' })];
    const res = findDuplicates(input({ description: 'cafe martinez' }), existing);
    expect(res[0].reason).toBe('amount-date-desc');
  });

  it('ordena same-file antes que los parecidos por monto/fecha', () => {
    const existing = [
      tx({ occurred_on: '2026-06-16' }),
      tx({ amount: 5, occurred_on: '2020-01-01', attachmentContentHash: 'h' }),
    ];
    const res = findDuplicates(input({ contentHash: 'h' }), existing);
    expect(res.map((c) => c.reason)).toEqual(['same-file', 'amount-date']);
  });

  it('la ventana es la constante documentada (±2)', () => {
    expect(SIMILAR_DATE_WINDOW_DAYS).toBe(2);
  });
});
