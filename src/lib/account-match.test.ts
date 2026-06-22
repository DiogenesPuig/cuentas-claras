import { describe, expect, it } from 'vitest';
import {
  accountDefaultsFromHint,
  matchAccount,
  type AccountHint,
  type MatchableAccount,
} from './account-match';

const ACCOUNTS: MatchableAccount[] = [
  { id: 'visa-juan', bank: 'Banco Patagonia', network: 'visa', last4: '1234', holderName: 'Juan Pérez' },
  { id: 'visa-maria', bank: 'Banco Patagonia', network: 'visa', last4: '5678', holderName: 'María Gómez', isExtension: true },
  { id: 'mc-lucas', bank: 'Banco Nación', network: 'mastercard', last4: null, holderName: 'Lucas Puig' },
];

describe('matchAccount', () => {
  it('matchea fuerte por last4 + red (resumen Patagonia)', () => {
    const hint: AccountHint = { bank: 'Banco Patagonia', network: 'visa', last4: '1234', holder: 'JUAN PEREZ' };
    const { matched, candidates } = matchAccount(hint, ACCOUNTS);
    expect(matched?.id).toBe('visa-juan');
    expect(candidates).toHaveLength(0);
  });

  it('distingue titular de extensión por su propio last4', () => {
    const hint: AccountHint = { bank: 'Banco Patagonia', network: 'visa', last4: '5678', holder: 'MARIA GOMEZ' };
    expect(matchAccount(hint, ACCOUNTS).matched?.id).toBe('visa-maria');
  });

  it('matchea por titular + banco cuando el resumen no trae last4 (Nativa)', () => {
    const hint: AccountHint = { bank: 'Banco Nación', network: 'mastercard', last4: null, holder: 'PUIG LUCAS MIGUEL D' };
    const { matched } = matchAccount(hint, ACCOUNTS);
    expect(matched?.id).toBe('mc-lucas'); // "PUIG" + "LUCAS" comparten 2 tokens
  });

  it('sin coincidencia (last4 nuevo) → ni match ni candidatos por last4', () => {
    const hint: AccountHint = { bank: 'Banco Galicia', network: 'visa', last4: '9999', holder: 'OTRO TITULAR' };
    const res = matchAccount(hint, ACCOUNTS);
    expect(res.matched).toBeNull();
    expect(res.candidates).toHaveLength(0);
  });

  it('mismo last4 en dos medios → desambigua por titular', () => {
    const dup: MatchableAccount[] = [
      { id: 'a', bank: 'X', network: 'visa', last4: '1111', holderName: 'Ana Lopez' },
      { id: 'b', bank: 'X', network: 'visa', last4: '1111', holderName: 'Beto Ruiz' },
    ];
    const hint: AccountHint = { bank: 'X', network: 'visa', last4: '1111', holder: 'BETO RUIZ' };
    expect(matchAccount(hint, dup).matched?.id).toBe('b');
  });

  it('mismo last4 sin poder desambiguar → candidatos para que elija el usuario', () => {
    const dup: MatchableAccount[] = [
      { id: 'a', bank: 'X', network: 'visa', last4: '1111', holderName: 'Ana Lopez' },
      { id: 'b', bank: 'X', network: 'visa', last4: '1111', holderName: 'Beto Ruiz' },
    ];
    const hint: AccountHint = { bank: 'X', network: 'visa', last4: '1111', holder: 'NOMBRE QUE NO MATCHEA' };
    const res = matchAccount(hint, dup);
    expect(res.matched).toBeNull();
    expect(res.candidates.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('red incompatible con el mismo last4 no matchea', () => {
    const hint: AccountHint = { bank: 'Banco Patagonia', network: 'mastercard', last4: '1234', holder: 'JUAN PEREZ' };
    expect(matchAccount(hint, ACCOUNTS).matched).toBeNull();
  });
});

describe('accountDefaultsFromHint', () => {
  it('arma valores precargados para el alta inline', () => {
    const hint: AccountHint = { bank: 'Banco Patagonia', network: 'visa', last4: '1234', holder: 'JUAN PEREZ' };
    expect(accountDefaultsFromHint(hint)).toEqual({
      name: 'Banco Patagonia visa ••1234',
      bank: 'Banco Patagonia',
      network: 'visa',
      last4: '1234',
      holderName: 'JUAN PEREZ',
    });
  });

  it('sin banco ni last4 (Nativa) cae a la red', () => {
    expect(accountDefaultsFromHint({ bank: null, network: 'mastercard', last4: null, holder: 'LUCAS' }).name).toBe(
      'mastercard',
    );
  });
});
