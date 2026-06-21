import { describe, expect, it } from 'vitest';
import { aggregateByDimension, monthlySeries, personaAccounts } from './aggregate';
import type { ReportTransactionView, ReportAccount } from './api';

function makeAccount(overrides: Partial<ReportAccount> = {}): ReportAccount {
  return {
    name: 'Visa Nación Juan',
    bank: 'Banco Nación',
    network: 'visa',
    type: 'credit',
    holder_name: 'Juan',
    is_extension: false,
    parent_account_id: null,
    billing_close_day: 10,
    ...overrides,
  };
}

function makeTx(overrides: Partial<ReportTransactionView> = {}): ReportTransactionView {
  return {
    id: 'tx-1',
    workspace_id: 'ws-1',
    type: 'expense',
    amount: 100,
    currency: 'ARS',
    amount_base: null,
    fx_rate: null,
    fx_date: null,
    occurred_on: '2026-01-15',
    charged_on: null,
    description: null,
    category_id: null,
    account_id: null,
    created_by: 'user-1',
    source: 'manual',
    is_shared: false,
    attachment_id: null,
    external_hash: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    account: null,
    category: null,
    ...overrides,
  };
}

const noRate = () => undefined;
const flatRate: Record<string, number> = { USD: 1000 };
const rateFor = (currency: string) => flatRate[currency];

describe('aggregateByDimension', () => {
  it('agrupa por categoría y los grupos suman el total del período', () => {
    const transactions = [
      makeTx({ amount: 100, category: { name: 'Comida' } }),
      makeTx({ amount: 50, category: { name: 'Comida' } }),
      makeTx({ amount: 200, category: { name: 'Transporte' } }),
      makeTx({ amount: 30, category: null }),
    ];

    const groups = aggregateByDimension(transactions, 'categoria', 'ARS', noRate);
    const totalExpense = groups.reduce((sum, g) => sum + g.consolidated.expense, 0);

    expect(totalExpense).toBe(380);
    expect(groups.find((g) => g.key === 'Comida')?.consolidated.expense).toBe(150);
    expect(groups.find((g) => g.key === 'Sin categoría')?.consolidated.expense).toBe(30);
  });

  it('por persona agrupa por holder_name del medio usado, no por titular', () => {
    const transactions = [
      makeTx({ amount: 100, account: makeAccount({ holder_name: 'Pepito', is_extension: true }) }),
      makeTx({ amount: 50, account: makeAccount({ holder_name: 'Juan', is_extension: false }) }),
    ];

    const groups = aggregateByDimension(transactions, 'persona', 'ARS', noRate);

    expect(groups.find((g) => g.key === 'Pepito')?.consolidated.expense).toBe(100);
    expect(groups.find((g) => g.key === 'Juan')?.consolidated.expense).toBe(50);
  });

  it('movimientos sin medio caen en "Sin medio" para banco/red/medio', () => {
    const transactions = [makeTx({ amount: 40, account: null })];

    for (const dimension of ['banco', 'red', 'medio'] as const) {
      const groups = aggregateByDimension(transactions, dimension, 'ARS', noRate);
      expect(groups).toEqual([
        { key: 'Sin medio', consolidated: { income: 0, expense: 40, balance: -40, byCurrency: { ARS: { income: 0, expense: 40, balance: -40 } } } },
      ]);
    }
  });

  it('usa la cotización histórica de cada movimiento (cierre de tarjeta de crédito) para el consolidado', () => {
    const transactions = [
      makeTx({
        amount: 10,
        currency: 'USD',
        occurred_on: '2026-01-05',
        charged_on: null,
        account: makeAccount({ type: 'credit', billing_close_day: 10, bank: 'Banco X' }),
      }),
    ];

    const groups = aggregateByDimension(transactions, 'banco', 'ARS', rateFor);
    expect(groups[0].consolidated.expense).toBe(10 * 1000);
  });
});

describe('monthlySeries', () => {
  it('devuelve un consolidado por mes, en el orden pedido', () => {
    const transactions = [
      makeTx({ amount: 100, occurred_on: '2026-01-10' }),
      makeTx({ amount: 50, occurred_on: '2026-02-05' }),
    ];

    const series = monthlySeries(transactions, ['2026-01', '2026-02', '2026-03'], 'ARS', noRate);

    expect(series.map((m) => m.consolidated.expense)).toEqual([100, 50, 0]);
    expect(series.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});

describe('personaAccounts', () => {
  it('marca las extensiones con el holder de la tarjeta titular', () => {
    const accounts = [
      { id: 'acc-juan', name: 'Visa Juan', holder_name: 'Juan', is_extension: false, parent_account_id: null },
      {
        id: 'acc-pepito',
        name: 'Visa Pepito (ext.)',
        holder_name: 'Pepito',
        is_extension: true,
        parent_account_id: 'acc-juan',
      },
    ];

    const result = personaAccounts(accounts);

    expect(result.get('Pepito')).toEqual([
      { accountName: 'Visa Pepito (ext.)', isExtension: true, titularHolderName: 'Juan' },
    ]);
    expect(result.get('Juan')).toEqual([
      { accountName: 'Visa Juan', isExtension: false, titularHolderName: null },
    ]);
  });
});
