import { describe, expect, it } from 'vitest';
import { NO_ACCOUNT_PERSONA, personaKeyOf, personaLabelOf, type PersonaTransaction } from './persona';

const NAMES = new Map<string, string>([
  ['m-ana', 'Ana Gómez'],
  ['m-juan', 'Juan Pérez'],
]);

function tx(overrides: Partial<PersonaTransaction> = {}): PersonaTransaction {
  return { owner_member_id: null, account: null, ...overrides };
}

describe('personaKeyOf', () => {
  it('la persona del movimiento manda sobre el medio', () => {
    const t = tx({
      owner_member_id: 'm-ana',
      account: { owner_member_id: 'm-juan', holder_name: 'Juan' },
    });
    expect(personaKeyOf(t)).toBe('member:m-ana');
  });

  it('sin persona en el movimiento, usa la del medio', () => {
    const t = tx({ account: { owner_member_id: 'm-juan', holder_name: 'Juan' } });
    expect(personaKeyOf(t)).toBe('member:m-juan');
  });

  it('medio sin miembro cae al holder_name normalizado', () => {
    const a = tx({ account: { owner_member_id: null, holder_name: 'José Pérez' } });
    const b = tx({ account: { owner_member_id: null, holder_name: 'JOSE  PEREZ' } });
    expect(personaKeyOf(a)).toBe(personaKeyOf(b));
  });

  it('sin medio ni persona es "Sin medio"', () => {
    expect(personaKeyOf(tx())).toBe(NO_ACCOUNT_PERSONA);
  });
});

describe('personaLabelOf', () => {
  it('usa el nombre VIVO del miembro, no el holder_name congelado (BUG-17)', () => {
    const t = tx({
      owner_member_id: 'm-ana',
      account: { owner_member_id: 'm-ana', holder_name: 'Ana (viejo)' },
    });
    expect(personaLabelOf(t, NAMES)).toBe('Ana Gómez');
  });

  it('miembro desconocido cae al holder_name del medio', () => {
    const t = tx({ owner_member_id: 'm-x', account: { owner_member_id: null, holder_name: 'Equis' } });
    expect(personaLabelOf(t, NAMES)).toBe('Equis');
  });

  it('medio sin miembro muestra el holder_name', () => {
    const t = tx({ account: { owner_member_id: null, holder_name: 'José Pérez' } });
    expect(personaLabelOf(t, NAMES)).toBe('José Pérez');
  });

  it('sin medio ni persona es "Sin medio"', () => {
    expect(personaLabelOf(tx(), NAMES)).toBe(NO_ACCOUNT_PERSONA);
  });
});
