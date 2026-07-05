import { describe, expect, it } from 'vitest';
import {
  bankFor,
  counterpartyFor,
  findTransferAccount,
  holderFor,
  ownerSideFor,
  transferAccountDefaults,
  type TransferAccountLike,
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

describe('findTransferAccount', () => {
  function acc(overrides: Partial<TransferAccountLike>): TransferAccountLike {
    return {
      id: 'acc-1',
      bank: null,
      network: null,
      last4: null,
      holder_name: null,
      is_extension: false,
      owner_member_id: null,
      ...overrides,
    };
  }

  it('sin titular no matchea nada', () => {
    expect(findTransferAccount(null, 'member-1', [acc({})])).toBeNull();
  });

  it('matchea por owner_member_id cuando el titular es un miembro', () => {
    const juan = acc({ id: 'acc-juan', owner_member_id: 'member-juan', holder_name: 'Juan Pérez' });
    const otro = acc({ id: 'acc-otro', owner_member_id: 'member-otro', holder_name: 'Otro' });
    expect(findTransferAccount('Juan Pérez', 'member-juan', [otro, juan])).toBe(juan);
  });

  it('BUG-8: miembro sin medio vinculado por owner_member_id → reusa el medio existente por nombre', () => {
    // El medio se creó por nombre (owner_member_id null) antes de que Juan fuera miembro.
    const juanPorNombre = acc({ id: 'acc-juan', owner_member_id: null, holder_name: 'Juan Pérez' });
    // Ahora Juan matchea a un miembro, pero ningún medio tiene ese owner_member_id.
    expect(findTransferAccount('Juan Pérez', 'member-juan', [juanPorNombre])).toBe(juanPorNombre);
  });

  it('sin member match, cae al match fuzzy por holder_name', () => {
    const juan = acc({ id: 'acc-juan', holder_name: 'Juan Pérez' });
    expect(findTransferAccount('Juan Perez', null, [juan])).toBe(juan);
  });

  it('devuelve null si no hay ningún medio del titular', () => {
    const maria = acc({ id: 'acc-maria', holder_name: 'María Gómez' });
    expect(findTransferAccount('Juan Pérez', 'member-juan', [maria])).toBeNull();
  });
});

describe('transferAccountDefaults', () => {
  it('nombre genérico "Transferencia", sin banco (un medio por persona, F2-11)', () => {
    expect(transferAccountDefaults('Juan Pérez')).toEqual({
      name: 'Transferencia',
      holderName: 'Juan Pérez',
    });
  });

  it('sin titular, deja el nombre del titular vacío', () => {
    expect(transferAccountDefaults(null)).toEqual({
      name: 'Transferencia',
      holderName: '',
    });
  });
});
