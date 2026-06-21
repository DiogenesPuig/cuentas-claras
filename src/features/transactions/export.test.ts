import { describe, expect, it } from 'vitest';
import { toCsv, toExportRows } from './export';
import type { TransactionView } from './api';

function makeTransaction(overrides: Partial<TransactionView> = {}): TransactionView {
  return {
    id: '1',
    workspace_id: 'w1',
    type: 'expense',
    amount: 1500.5,
    currency: 'ARS',
    description: 'Supermercado',
    category_id: 'c1',
    account_id: 'a1',
    occurred_on: '2026-06-10',
    charged_on: '2026-07-01',
    attachment_id: null,
    source: 'manual',
    created_by: 'u1',
    created_at: '2026-06-10T00:00:00Z',
    updated_at: '2026-06-10T00:00:00Z',
    account: { name: 'Visa Nación Pepito', holder_name: 'Pepito', bank: 'Banco Nación' },
    category: { name: 'Comida', icon: null },
    ...overrides,
  } as TransactionView;
}

describe('toExportRows', () => {
  it('mapea un movimiento a una fila plana con sus datos', () => {
    const [row] = toExportRows([makeTransaction()]);

    expect(row).toEqual({
      fecha: '2026-06-10',
      seCobra: '2026-07-01',
      tipo: 'Gasto',
      monto: 1500.5,
      moneda: 'ARS',
      persona: 'Pepito',
      medio: 'Visa Nación Pepito',
      banco: 'Banco Nación',
      categoria: 'Comida',
      descripcion: 'Supermercado',
    });
  });

  it('usa cadenas vacías cuando faltan datos opcionales', () => {
    const [row] = toExportRows([
      makeTransaction({ charged_on: null, description: null, account: null, category: null }),
    ]);

    expect(row.seCobra).toBe('');
    expect(row.descripcion).toBe('');
    expect(row.persona).toBe('');
    expect(row.medio).toBe('');
    expect(row.banco).toBe('');
    expect(row.categoria).toBe('');
  });

  it('marca los ingresos como tales', () => {
    const [row] = toExportRows([makeTransaction({ type: 'income' })]);
    expect(row.tipo).toBe('Ingreso');
  });
});

describe('toCsv', () => {
  it('arma un CSV con encabezado y una línea por fila', () => {
    const csv = toCsv(toExportRows([makeTransaction()]));
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Fecha,Se cobra,Tipo,Monto,Moneda,Persona,Medio,Banco,Categoría,Descripción');
    expect(lines[1]).toBe(
      '2026-06-10,2026-07-01,Gasto,1500.5,ARS,Pepito,Visa Nación Pepito,Banco Nación,Comida,Supermercado',
    );
  });

  it('escapa comas y comillas en los campos de texto', () => {
    const csv = toCsv(
      toExportRows([makeTransaction({ description: 'Café, medialunas y "extra"' })]),
    );

    expect(csv).toContain('"Café, medialunas y ""extra"""');
  });
});
