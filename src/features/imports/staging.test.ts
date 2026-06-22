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
        { occurred_on: '2026-05-20', description: 'COMERCIO DEVUELVE', amount: 500, currency: 'ARS', installment: null, kind: 'refund' },
      ],
    },
  ],
};

describe('buildStagingModel', () => {
  it('destilda solo el pago de tarjeta; consumos y reintegros tildados', () => {
    const model = buildStagingModel(PARSE);
    expect(model.statementCloseOn).toBe('2026-05-28');
    const [card] = model.cards;
    expect(card.accountHint.last4).toBe('1234');
    // payment destildado; charge, charge(cuota) y refund tildados.
    expect(card.rows.map((r) => r.include)).toEqual([false, true, true, true]);
    expect(card.rows[1].occurredOn).toBe('15/05/2026');
    expect(card.rows[2].installmentN).toBe(2);
  });
});

describe('countSelected / toImportRows', () => {
  it('importa consumos y reintegros (con signo negativo), no el pago', () => {
    const model = buildStagingModel(PARSE);
    expect(countSelected(model)).toBe(3); // 2 consumos + 1 reintegro, no el pago

    model.cards[0].accountId = 'acc-1';
    const rows = toImportRows(model);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      amount: 6099,
      currency: 'ARS',
      accountId: 'acc-1',
      occurredOn: '2026-05-15',
    });
    expect(rows[1].installmentN).toBe(2);
    expect(rows[1].installmentTotal).toBe(3);
    // El reintegro entra como gasto negativo (netea).
    expect(rows[2]).toMatchObject({ amount: -500, occurredOn: '2026-05-20' });
  });

  it('excluye filas con monto inválido o fecha vacía', () => {
    const model = buildStagingModel(PARSE);
    model.cards[0].rows[1].amount = '0';
    model.cards[0].rows[2].occurredOn = '';
    model.cards[0].rows[3].amount = '-5'; // magnitud inválida (Number<=0)
    expect(countSelected(model)).toBe(0);
    expect(toImportRows(model)).toEqual([]);
  });
});
