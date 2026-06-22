import { describe, expect, it } from 'vitest';
import { accountLabel } from './format';

describe('accountLabel', () => {
  it('muestra banco · red · últimos 4 (sin el nombre)', () => {
    expect(
      accountLabel({ name: 'Visa Juan', bank: 'Banco Patagonia', network: 'visa', last4: '1234' }),
    ).toBe('Banco Patagonia · Visa · ••1234');
  });

  it('omite los campos ausentes y cae al nombre si no hay ninguno', () => {
    expect(accountLabel({ name: 'Efectivo', bank: null, network: null, last4: null })).toBe('Efectivo');
    expect(accountLabel({ name: 'MC', bank: null, network: 'mastercard', last4: '9999' })).toBe(
      'Master · ••9999',
    );
  });
});
