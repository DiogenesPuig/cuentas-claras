import { describe, expect, it } from 'vitest';
import {
  accountDefaultsFromHint,
  accountsToMatchable,
  isResidualHint,
  matchAccount,
  type AccountHint,
  type AccountLike,
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

  it('NO asocia un resumen a una tarjeta de OTRO banco aunque coincida el titular', () => {
    const accounts: MatchableAccount[] = [
      { id: 'pat-lucas', bank: 'Banco Patagonia', network: 'mastercard', last4: null, holderName: 'Lucas Puig' },
    ];
    const hint: AccountHint = { bank: 'Banco Nación', network: 'mastercard', last4: null, holder: 'PUIG LUCAS MIGUEL' };
    const res = matchAccount(hint, accounts);
    expect(res.matched).toBeNull(); // banco en conflicto: Nación ≠ Patagonia
    expect(res.candidates).toHaveLength(0);
  });

  it('si el resumen no trae banco, el titular solo deja candidatos (no auto-match cruzado)', () => {
    const accounts: MatchableAccount[] = [
      { id: 'pat-lucas', bank: 'Banco Patagonia', network: 'mastercard', last4: null, holderName: 'Lucas Puig' },
    ];
    const hint: AccountHint = { bank: null, network: 'mastercard', last4: null, holder: 'PUIG LUCAS MIGUEL' };
    const res = matchAccount(hint, accounts);
    expect(res.matched).toBeNull();
    expect(res.candidates.map((c) => c.id)).toEqual(['pat-lucas']);
  });
});

describe('matchAccount con allowHolderOnlyMatch (transferencias F2-9)', () => {
  const TRANSFER_ACCOUNTS: MatchableAccount[] = [
    { id: 'tr-lucas', bank: null, network: null, last4: null, holderName: 'Lucas Puig' },
  ];

  it('auto-asocia por titular aunque falte el banco (medio ya creado)', () => {
    const hint: AccountHint = { bank: null, network: null, last4: null, holder: 'PUIG LUCAS MIGUEL' };
    const res = matchAccount(hint, TRANSFER_ACCOUNTS, { allowHolderOnlyMatch: true });
    expect(res.matched?.id).toBe('tr-lucas');
  });

  it('sin la opción, el mismo caso queda como candidato (no recrea, pero no auto)', () => {
    const hint: AccountHint = { bank: null, network: null, last4: null, holder: 'PUIG LUCAS MIGUEL' };
    expect(matchAccount(hint, TRANSFER_ACCOUNTS).matched).toBeNull();
  });

  it('dos medios del mismo titular → no auto-asocia (ambiguo)', () => {
    const accounts: MatchableAccount[] = [
      { id: 'a', bank: null, network: null, last4: null, holderName: 'Lucas Puig' },
      { id: 'b', bank: 'Galicia', network: null, last4: null, holderName: 'Lucas Puig' },
    ];
    const hint: AccountHint = { bank: null, network: null, last4: null, holder: 'LUCAS PUIG' };
    const res = matchAccount(hint, accounts, { allowHolderOnlyMatch: true });
    expect(res.matched).toBeNull();
    expect(res.candidates.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('no cruza bancos en conflicto ni siquiera en modo transferencia', () => {
    const accounts: MatchableAccount[] = [
      { id: 'pat', bank: 'Banco Patagonia', network: null, last4: null, holderName: 'Lucas Puig' },
    ];
    const hint: AccountHint = { bank: 'Banco Nación', network: null, last4: null, holder: 'LUCAS PUIG' };
    expect(matchAccount(hint, accounts, { allowHolderOnlyMatch: true }).matched).toBeNull();
  });
});

describe('matchAccount con holder_aliases (MEJ-4)', () => {
  it('un alias exacto de una sola palabra ("Pepito") resuelve el match', () => {
    const accounts: MatchableAccount[] = [
      { id: 'tr-jose', bank: null, network: null, last4: null, holderName: 'José Pérez', holderAliases: ['Pepito'] },
    ];
    const hint: AccountHint = { bank: null, network: null, last4: null, holder: 'Pepito' };
    const res = matchAccount(hint, accounts, { allowHolderOnlyMatch: true });
    expect(res.matched?.id).toBe('tr-jose');
  });

  it('variante de orden/tildes del nombre principal colapsa sola (sin alias)', () => {
    const accounts: MatchableAccount[] = [
      { id: 'tr-jose', bank: null, network: null, last4: null, holderName: 'José Pérez' },
    ];
    const hint: AccountHint = { bank: null, network: null, last4: null, holder: 'perez jose' };
    expect(matchAccount(hint, accounts, { allowHolderOnlyMatch: true }).matched?.id).toBe('tr-jose');
  });

  it('una persona distinta NO matchea aunque el medio tenga alias', () => {
    const accounts: MatchableAccount[] = [
      { id: 'tr-jose', bank: null, network: null, last4: null, holderName: 'José Pérez', holderAliases: ['Pepito'] },
    ];
    const hint: AccountHint = { bank: null, network: null, last4: null, holder: 'María Gómez' };
    expect(matchAccount(hint, accounts, { allowHolderOnlyMatch: true }).matched).toBeNull();
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

describe('isResidualHint (BUG-5: sección de impuestos/cargos al pie)', () => {
  it('es residual cuando no hay last4 ni titular (impuestos al pie)', () => {
    expect(isResidualHint({ bank: 'Banco Patagonia', network: 'visa', last4: null, holder: null })).toBe(true);
    expect(isResidualHint({ bank: null, network: null, last4: null, holder: null })).toBe(true);
  });

  it('no es residual si hay last4 (tarjeta real, ej. Patagonia)', () => {
    expect(isResidualHint({ bank: 'Banco Patagonia', network: 'visa', last4: '1234', holder: null })).toBe(false);
  });

  it('no es residual si hay titular (tarjeta sin last4, ej. Nativa)', () => {
    expect(isResidualHint({ bank: 'Banco Nación', network: 'mastercard', last4: null, holder: 'Lucas Puig' })).toBe(false);
  });
});

describe('accountsToMatchable (REF-1: helper único, antes duplicado en TransactionForm/StatementImport)', () => {
  it('proyecta la forma DB (snake_case) a MatchableAccount, incluido isExtension', () => {
    const dbAccounts: AccountLike[] = [
      {
        id: 'visa-maria',
        bank: 'Banco Patagonia',
        network: 'visa',
        last4: '5678',
        holder_name: 'María Gómez',
        is_extension: true,
      },
    ];
    expect(accountsToMatchable(dbAccounts)).toEqual([
      {
        id: 'visa-maria',
        bank: 'Banco Patagonia',
        network: 'visa',
        last4: '5678',
        holderName: 'María Gómez',
        holderAliases: [],
        isExtension: true,
      },
    ]);
  });
});
