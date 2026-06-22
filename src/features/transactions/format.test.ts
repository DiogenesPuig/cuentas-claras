import { describe, expect, it } from 'vitest';
import { formatInstallment } from './format';

describe('formatInstallment', () => {
  it('formatea una cuota válida como "Cuota N/M"', () => {
    expect(formatInstallment(2, 3)).toBe('Cuota 2/3');
    expect(formatInstallment(1, 1)).toBe('Cuota 1/1');
  });

  it('devuelve null cuando no es en cuotas (algún campo null/undefined)', () => {
    expect(formatInstallment(null, null)).toBeNull();
    expect(formatInstallment(2, null)).toBeNull();
    expect(formatInstallment(null, 3)).toBeNull();
    expect(formatInstallment(undefined, undefined)).toBeNull();
  });

  it('devuelve null ante datos incoherentes o no enteros', () => {
    expect(formatInstallment(0, 3)).toBeNull();
    expect(formatInstallment(4, 3)).toBeNull();
    expect(formatInstallment(2.5, 3)).toBeNull();
    expect(formatInstallment(2, 0)).toBeNull();
  });
});
