import { describe, expect, it } from 'vitest';
import {
  aggregateByDimension,
  aggregateByPersonaMembersOnly,
  OTHERS_LABEL,
  filterReportTransactions,
  monthlySeries,
  personaAccounts,
  personaSpending,
} from './aggregate';
import type { ReportTransactionView, ReportAccount } from './api';

function makeAccount(overrides: Partial<ReportAccount> = {}): ReportAccount {
  return {
    name: 'Visa Nación Juan',
    bank: 'Banco Nación',
    network: 'visa',
    type: 'credit',
    holder_name: 'Juan',
    owner_member_id: null,
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
    owner_member_id: null,
    amount_base: null,
    fx_rate: null,
    fx_date: null,
    occurred_on: '2026-01-15',
    charged_on: null,
    description: null,
    category_id: null,
    account_id: null,
    bank: null,
    created_by: 'user-1',
    source: 'manual',
    is_shared: false,
    attachment_id: null,
    external_hash: null,
    installment_n: null,
    installment_total: null,
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

    expect(groups.find((g) => g.label === 'Pepito')?.consolidated.expense).toBe(100);
    expect(groups.find((g) => g.label === 'Juan')?.consolidated.expense).toBe(50);
  });

  it('movimientos sin medio caen en "Sin medio" para banco/red/medio', () => {
    const transactions = [makeTx({ amount: 40, account: null })];

    for (const dimension of ['banco', 'red', 'medio'] as const) {
      const groups = aggregateByDimension(transactions, dimension, 'ARS', noRate);
      expect(groups).toEqual([
        {
          key: 'Sin medio',
          label: 'Sin medio',
          consolidated: {
            income: 0,
            expense: 40,
            balance: -40,
            byCurrency: { ARS: { income: 0, expense: 40, balance: -40 } },
            missingRates: [],
          },
        },
      ]);
    }
  });

  it('F2-10: dos medios del mismo owner_member_id se fusionan en una sola persona (nombre vivo del miembro)', () => {
    const memberNameById = new Map([['member-1', 'Juan Pérez']]);
    const transactions = [
      makeTx({
        amount: 100,
        account: makeAccount({ holder_name: 'PEREZ JUAN', owner_member_id: 'member-1' }),
      }),
      makeTx({
        amount: 50,
        account: makeAccount({ holder_name: 'Juan Perez', owner_member_id: 'member-1' }),
      }),
    ];

    const groups = aggregateByDimension(transactions, 'persona', 'ARS', noRate, memberNameById);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Juan Pérez');
    expect(groups[0].consolidated.expense).toBe(150);
  });

  it('IDENT-1: la persona del MOVIMIENTO (owner_member_id) manda sobre la del medio', () => {
    const memberNameById = new Map([['member-maria', 'María Gómez']]);
    const transactions = [
      // Medio compartido "Transferencia" (sin dueño), pero el movimiento es de María.
      makeTx({
        amount: 100,
        owner_member_id: 'member-maria',
        account: makeAccount({ holder_name: 'Transferencia', owner_member_id: null }),
      }),
    ];

    const groups = aggregateByDimension(transactions, 'persona', 'ARS', noRate, memberNameById);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('María Gómez');
    expect(groups[0].consolidated.expense).toBe(100);
  });

  it('F2-10: sin owner_member_id, dos holder_name con orden/tildes distintos se fusionan por nombre normalizado', () => {
    const transactions = [
      makeTx({
        amount: 100,
        account: makeAccount({ holder_name: 'Pérez Juan', owner_member_id: null }),
      }),
      makeTx({
        amount: 30,
        account: makeAccount({ holder_name: 'Juan Perez', owner_member_id: null }),
      }),
    ];

    const groups = aggregateByDimension(transactions, 'persona', 'ARS', noRate);

    expect(groups).toHaveLength(1);
    expect(groups[0].consolidated.expense).toBe(130);
  });

  it('F2-10: dos personas realmente distintas (sin miembro) no se fusionan', () => {
    const transactions = [
      makeTx({
        amount: 100,
        account: makeAccount({ holder_name: 'Ana Gómez', owner_member_id: null }),
      }),
      makeTx({
        amount: 30,
        account: makeAccount({ holder_name: 'Beto López', owner_member_id: null }),
      }),
    ];

    const groups = aggregateByDimension(transactions, 'persona', 'ARS', noRate);

    expect(groups).toHaveLength(2);
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

  it('F2-11: en "banco" prioriza tx.bank (transferencia) sobre el banco del medio', () => {
    const transactions = [
      // Transferencia: el banco vive en tx.bank; el medio 'transfer' no tiene banco.
      makeTx({ amount: 100, bank: 'Banco Galicia', account: makeAccount({ bank: null }) }),
      // Compra normal: sin tx.bank, cae al banco del medio.
      makeTx({ amount: 50, bank: null, account: makeAccount({ bank: 'Banco Nación' }) }),
    ];

    const groups = aggregateByDimension(transactions, 'banco', 'ARS', noRate);

    expect(groups.find((g) => g.key === 'Banco Galicia')?.consolidated.expense).toBe(100);
    expect(groups.find((g) => g.key === 'Banco Nación')?.consolidated.expense).toBe(50);
  });
});

describe('aggregateByPersonaMembersOnly (MEJ-5: donut de resumen, solo miembros + "Otros")', () => {
  const memberNameById = new Map([
    ['member-1', 'Juan Pérez'],
    ['member-2', 'Ana Gómez'],
  ]);

  it('deja a cada miembro como porción propia y colapsa a los no-miembros en "Otros"', () => {
    const transactions = [
      makeTx({
        amount: 100,
        account: makeAccount({ holder_name: 'Juan', owner_member_id: 'member-1' }),
      }),
      makeTx({
        amount: 40,
        account: makeAccount({ holder_name: 'Ana', owner_member_id: 'member-2' }),
      }),
      // No-miembros: dos titulares ajenos distintos → ambos a "Otros".
      makeTx({
        amount: 30,
        account: makeAccount({ holder_name: 'Carlos Ajeno', owner_member_id: null }),
      }),
      makeTx({
        amount: 20,
        account: makeAccount({ holder_name: 'Dora Externa', owner_member_id: null }),
      }),
    ];

    const groups = aggregateByPersonaMembersOnly(transactions, 'ARS', noRate, memberNameById);

    const otros = groups.find((g) => g.label === OTHERS_LABEL);
    expect(otros?.consolidated.expense).toBe(50); // 30 + 20 colapsados
    expect(
      groups
        .filter((g) => g.label !== OTHERS_LABEL)
        .map((g) => g.label)
        .sort(),
    ).toEqual(['Ana Gómez', 'Juan Pérez']);
  });

  it('los movimientos sin medio también caen en "Otros"', () => {
    const transactions = [
      makeTx({
        amount: 100,
        account: makeAccount({ holder_name: 'Juan', owner_member_id: 'member-1' }),
      }),
      makeTx({ amount: 25, account: null }),
    ];

    const groups = aggregateByPersonaMembersOnly(transactions, 'ARS', noRate, memberNameById);

    expect(groups.find((g) => g.label === OTHERS_LABEL)?.consolidated.expense).toBe(25);
  });

  it('no hay porción "Otros" si todos son miembros', () => {
    const transactions = [
      makeTx({
        amount: 100,
        account: makeAccount({ holder_name: 'Juan', owner_member_id: 'member-1' }),
      }),
      makeTx({
        amount: 40,
        account: makeAccount({ holder_name: 'Ana', owner_member_id: 'member-2' }),
      }),
    ];

    const groups = aggregateByPersonaMembersOnly(transactions, 'ARS', noRate, memberNameById);

    expect(groups.some((g) => g.label === OTHERS_LABEL)).toBe(false);
    expect(groups).toHaveLength(2);
  });

  it('separa ingresos y gastos en el consolidado de cada grupo (para los donut por métrica)', () => {
    const transactions = [
      makeTx({
        type: 'income',
        amount: 500,
        account: makeAccount({ holder_name: 'Juan', owner_member_id: 'member-1' }),
      }),
      makeTx({
        type: 'income',
        amount: 70,
        account: makeAccount({ holder_name: 'Ajeno', owner_member_id: null }),
      }),
    ];

    const groups = aggregateByPersonaMembersOnly(transactions, 'ARS', noRate, memberNameById);

    expect(groups.find((g) => g.label === 'Juan Pérez')?.consolidated.income).toBe(500);
    expect(groups.find((g) => g.label === OTHERS_LABEL)?.consolidated.income).toBe(70);
  });
});

describe('filterReportTransactions', () => {
  const txs = [
    makeTx({
      amount: 100,
      category: { name: 'Super' },
      account: makeAccount({ holder_name: 'Ana' }),
    }),
    makeTx({
      amount: 50,
      category: { name: 'Transporte' },
      account: makeAccount({ holder_name: 'Ana' }),
    }),
    makeTx({
      amount: 200,
      category: { name: 'Super' },
      account: makeAccount({ holder_name: 'Beto' }),
    }),
  ];

  it('sin filtros devuelve todo', () => {
    expect(filterReportTransactions(txs, {})).toHaveLength(3);
    expect(filterReportTransactions(txs, { persona: [] })).toHaveLength(3);
  });

  it('filtra por persona', () => {
    const out = filterReportTransactions(txs, { persona: ['Ana'] });
    expect(out).toHaveLength(2);
  });

  it('combina filtros (AND): persona + categoría', () => {
    const out = filterReportTransactions(txs, { persona: ['Ana'], categoria: ['Super'] });
    expect(out.map((t) => t.amount)).toEqual([100]);
  });

  it('varios valores en una dimensión se combinan con OR (Super o Transporte)', () => {
    const out = filterReportTransactions(txs, { categoria: ['Super', 'Transporte'] });
    expect(out.map((t) => t.amount)).toEqual([100, 50, 200]);
  });
});

describe('personaSpending', () => {
  it('da participación del total y la categoría dominante de cada persona', () => {
    const txs = [
      // Ana: 600 (450 Super = 75% → domina), 150 Transporte. Total general = 800 → Ana 75%.
      makeTx({
        amount: 450,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Ana' }),
      }),
      makeTx({
        amount: 150,
        category: { name: 'Transporte' },
        account: makeAccount({ holder_name: 'Ana' }),
      }),
      // Beto: 200 repartido 100/100 → ninguna supera el 40% del umbral relativo... 50% sí.
      makeTx({
        amount: 100,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Beto' }),
      }),
      makeTx({
        amount: 100,
        category: { name: 'Ocio' },
        account: makeAccount({ holder_name: 'Beto' }),
      }),
    ];

    const result = personaSpending(txs, 'ARS', noRate);
    const ana = result.find((p) => p.holder === 'Ana')!;
    const beto = result.find((p) => p.holder === 'Beto')!;

    expect(ana.expense).toBe(600);
    expect(ana.share).toBeCloseTo(0.75, 5);
    expect(ana.mainLabel).toBe('Super'); // 450/600 = 75% ≥ 40%
    expect(beto.share).toBeCloseTo(0.25, 5);
    expect(beto.mainLabel).toBe('Super'); // 100/200 = 50% ≥ 40% (primera por volumen)
  });

  it('MEJ-11: desglosa el gasto de cada persona por categoría, de mayor a menor', () => {
    const txs = [
      makeTx({
        amount: 450,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Ana' }),
      }),
      makeTx({
        amount: 150,
        category: { name: 'Transporte' },
        account: makeAccount({ holder_name: 'Ana' }),
      }),
      makeTx({
        amount: 100,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Beto' }),
      }),
      makeTx({
        amount: 100,
        category: { name: 'Ocio' },
        account: makeAccount({ holder_name: 'Beto' }),
      }),
    ];

    const ana = personaSpending(txs, 'ARS', noRate).find((p) => p.holder === 'Ana')!;

    expect(ana.categories).toEqual([
      { label: 'Super', amount: 450, share: 0.75 },
      { label: 'Transporte', amount: 150, share: 0.25 },
    ]);
  });

  it('MEJ-11: agrupa lo sin categoría bajo "Sin categoría"', () => {
    const txs = [
      makeTx({
        amount: 60,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Ana' }),
      }),
      makeTx({ amount: 40, category: null, account: makeAccount({ holder_name: 'Ana' }) }),
    ];

    const ana = personaSpending(txs, 'ARS', noRate)[0];

    expect(ana.categories).toEqual([
      { label: 'Super', amount: 60, share: 0.6 },
      { label: 'Sin categoría', amount: 40, share: 0.4 },
    ]);
  });

  it('marca "Varios" cuando ninguna categoría domina', () => {
    const txs = [
      makeTx({ amount: 30, category: { name: 'A' }, account: makeAccount({ holder_name: 'Ana' }) }),
      makeTx({ amount: 30, category: { name: 'B' }, account: makeAccount({ holder_name: 'Ana' }) }),
      makeTx({ amount: 30, category: { name: 'C' }, account: makeAccount({ holder_name: 'Ana' }) }),
    ];
    expect(personaSpending(txs, 'ARS', noRate)[0].mainLabel).toBe('Varios'); // 33% < 40%
  });

  it('ignora ingresos (solo gasto)', () => {
    const txs = [
      makeTx({ amount: 100, type: 'income', account: makeAccount({ holder_name: 'Ana' }) }),
      makeTx({
        amount: 40,
        type: 'expense',
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Ana' }),
      }),
    ];
    const result = personaSpending(txs, 'ARS', noRate);
    expect(result).toHaveLength(1);
    expect(result[0].expense).toBe(40);
  });

  it('F2-10: dos medios del mismo miembro con holder_name distinto cuentan como una sola persona', () => {
    const memberNameById = new Map([['member-1', 'Juan Pérez']]);
    const txs = [
      makeTx({
        amount: 60,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'PEREZ JUAN', owner_member_id: 'member-1' }),
      }),
      makeTx({
        amount: 40,
        category: { name: 'Super' },
        account: makeAccount({ holder_name: 'Juan Perez', owner_member_id: 'member-1' }),
      }),
    ];

    const result = personaSpending(txs, 'ARS', noRate, memberNameById);

    expect(result).toHaveLength(1);
    expect(result[0].holder).toBe('Juan Pérez');
    expect(result[0].expense).toBe(100);
    expect(result[0].share).toBe(1);
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
      {
        id: 'acc-juan',
        name: 'Visa Juan',
        holder_name: 'Juan',
        owner_member_id: null,
        is_extension: false,
        parent_account_id: null,
      },
      {
        id: 'acc-pepito',
        name: 'Visa Pepito (ext.)',
        holder_name: 'Pepito',
        owner_member_id: null,
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

  it('F2-10: agrupa por nombre vivo del miembro cuando hay owner_member_id, aunque el holder_name difiera', () => {
    const memberNameById = new Map([['member-1', 'Juan Pérez']]);
    const accounts = [
      {
        id: 'acc-1',
        name: 'Visa Nación',
        holder_name: 'PEREZ JUAN',
        owner_member_id: 'member-1',
        is_extension: false,
        parent_account_id: null,
      },
      {
        id: 'acc-2',
        name: 'Cuenta Galicia',
        holder_name: 'Juan Perez',
        owner_member_id: 'member-1',
        is_extension: false,
        parent_account_id: null,
      },
    ];

    const result = personaAccounts(accounts, memberNameById);

    expect(Array.from(result.keys())).toEqual(['Juan Pérez']);
    expect(result.get('Juan Pérez')).toHaveLength(2);
  });
});
