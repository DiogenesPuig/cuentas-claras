import { describe, expect, it } from 'vitest';
import type { StatementParse } from '@/lib/ingesta';
import { buildStagingModel, countSelected, toImportRows } from './staging';

const PARSE: StatementParse = {
  statement_close_on: '2026-05-28',
  cards: [
    {
      account_hint: { bank: 'Banco Patagonia', network: 'visa', last4: '1234', holder: 'JUAN PEREZ' },
      rows: [
        { occurred_on: '2026-05-11', description: 'SU PAGO', amount: 100000, currency: 'ARS', installment: null, kind: 'payment' },
        { occurred_on: '2026-05-15', description: 'COMERCIO UNO', amount: 6099, currency: 'ARS', installment: null, kind: 'charge' },
        { occurred_on: '2026-03-30', description: 'COMERCIO CUOTAS', amount: 11566.66, currency: 'ARS', installment: { n: 2, total: 3 }, kind: 'charge' },
      ],
    },
  ],
};

describe('buildStagingModel', () => {
  it('destilda pagos y deja tildados los consumos; fechas en DD/MM/AAAA', () => {
    const model = buildStagingModel(PARSE);
    expect(model.statementCloseOn).toBe('2026-05-28');
    const [card] = model.cards;
    expect(card.accountHint.last4).toBe('1234');
    expect(card.rows.map((r) => r.include)).toEqual([false, true, true]);
    expect(card.rows[1].occurredOn).toBe('15/05/2026');
    expect(card.rows[2].installmentN).toBe(2);
  });
});

describe('countSelected / toImportRows', () => {
  it('cuenta e importa solo las filas incluidas y válidas', () => {
    const model = buildStagingModel(PARSE);
    expect(countSelected(model)).toBe(2); // los dos consumos, no el pago

    model.cards[0].accountId = 'acc-1';
    const rows = toImportRows(model);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      amount: 6099,
      currency: 'ARS',
      accountId: 'acc-1',
      occurredOn: '2026-05-15',
    });
    expect(rows[1].installmentN).toBe(2);
    expect(rows[1].installmentTotal).toBe(3);
  });

  it('excluye filas con monto inválido o fecha vacía', () => {
    const model = buildStagingModel(PARSE);
    model.cards[0].rows[1].amount = '0';
    model.cards[0].rows[2].occurredOn = '';
    expect(countSelected(model)).toBe(0);
    expect(toImportRows(model)).toEqual([]);
  });
});
