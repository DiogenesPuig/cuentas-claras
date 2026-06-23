import { describe, expect, it } from 'vitest';
import {
  bankFor,
  counterpartyFor,
  holderFor,
  ownerSideFor,
  transferAccountDefaults,
  type TransferPartyInfo,
} from './transfer-account';

const INFO: TransferPartyInfo = {
  originHolder: 'Juan Pérez',
  originBank: 'Banco Patagonia',
  destHolder: 'María Gómez',
  destBank: 'Banco Galicia',
};

describe('ownerSideFor', () => {
  it('un gasto atribuye al origen (quien envía)', () => {
    expect(ownerSideFor('expense')).toBe('origin');
  });

  it('un ingreso atribuye al destino (quien recibe)', () => {
    expect(ownerSideFor('income')).toBe('dest');
  });
});

describe('holderFor / bankFor / counterpartyFor', () => {
  it('en origen, el dueño es el origen y la contraparte el destino', () => {
    expect(holderFor(INFO, 'origin')).toBe('Juan Pérez');
    expect(bankFor(INFO, 'origin')).toBe('Banco Patagonia');
    expect(counterpartyFor(INFO, 'origin')).toBe('María Gómez');
  });

  it('en destino, el dueño es el destino y la contraparte el origen', () => {
    expect(holderFor(INFO, 'dest')).toBe('María Gómez');
    expect(bankFor(INFO, 'dest')).toBe('Banco Galicia');
    expect(counterpartyFor(INFO, 'dest')).toBe('Juan Pérez');
  });
});

describe('transferAccountDefaults', () => {
  it('nombra el medio con el banco cuando está disponible', () => {
    expect(transferAccountDefaults('Juan Pérez', 'Banco Patagonia')).toEqual({
      name: 'Transferencia Banco Patagonia',
      bank: 'Banco Patagonia',
      holderName: 'Juan Pérez',
    });
  });

  it('sin banco, usa un nombre genérico', () => {
    expect(transferAccountDefaults('Juan Pérez', null)).toEqual({
      name: 'Transferencia',
      bank: '',
      holderName: 'Juan Pérez',
    });
  });
});
