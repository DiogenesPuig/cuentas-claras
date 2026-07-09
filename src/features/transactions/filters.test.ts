import { describe, expect, it } from 'vitest';
import { buildTransactionFilterArgs, NO_ACCOUNT_FILTER } from './filters';

describe('buildTransactionFilterArgs', () => {
  it('sin filtros, no agrega ningún argumento', () => {
    expect(buildTransactionFilterArgs({})).toEqual({});
  });

  it('un accountId real filtra por igualdad (no como "sin medio")', () => {
    expect(buildTransactionFilterArgs({ accountId: 'acc-1' })).toEqual({ accountId: 'acc-1' });
  });

  it('el centinela NO_ACCOUNT_FILTER pide movimientos sin medio (account_id IS NULL) (BUG-13)', () => {
    expect(buildTransactionFilterArgs({ accountId: NO_ACCOUNT_FILTER })).toEqual({
      accountIsNull: true,
    });
  });

  it('convierte el mes en un rango [from, to) con el mes siguiente exclusivo', () => {
    expect(buildTransactionFilterArgs({ month: '2026-06' })).toEqual({
      occurredFrom: '2026-06-01',
      occurredTo: '2026-07-01',
    });
  });

  it('el rango de diciembre cruza al año siguiente', () => {
    expect(buildTransactionFilterArgs({ month: '2025-12' })).toEqual({
      occurredFrom: '2025-12-01',
      occurredTo: '2026-01-01',
    });
  });

  it('combina mes con el resto de los filtros', () => {
    expect(
      buildTransactionFilterArgs({
        month: '2026-06',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        currency: 'ARS',
        holderName: 'Diogenes',
        search: 'super',
      }),
    ).toEqual({
      occurredFrom: '2026-06-01',
      occurredTo: '2026-07-01',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      currency: 'ARS',
      holderName: 'Diogenes',
      search: 'super',
    });
  });

  it('recorta espacios en la búsqueda y la omite si queda vacía', () => {
    expect(buildTransactionFilterArgs({ search: '  café  ' })).toEqual({ search: 'café' });
    expect(buildTransactionFilterArgs({ search: '   ' })).toEqual({});
  });

  it('escapa los comodines de ILIKE en la búsqueda para tratarlos como literales', () => {
    expect(buildTransactionFilterArgs({ search: '50%' })).toEqual({ search: '50\\%' });
    expect(buildTransactionFilterArgs({ search: 'a_b' })).toEqual({ search: 'a\\_b' });
    expect(buildTransactionFilterArgs({ search: 'c:\\temp' })).toEqual({ search: 'c:\\\\temp' });
  });

  it('omite strings vacíos en los demás filtros', () => {
    expect(
      buildTransactionFilterArgs({ accountId: '', categoryId: '', currency: '', holderName: '' }),
    ).toEqual({});
  });

  it('omite la moneda mientras no tenga el código completo de 3 letras', () => {
    expect(buildTransactionFilterArgs({ currency: 'A' })).toEqual({});
    expect(buildTransactionFilterArgs({ currency: 'AR' })).toEqual({});
    expect(buildTransactionFilterArgs({ currency: 'ARS' })).toEqual({ currency: 'ARS' });
  });
});
