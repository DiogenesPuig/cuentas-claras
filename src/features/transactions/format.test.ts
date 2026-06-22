import { describe, expect, it } from 'vitest';
import { displayToIsoDate, formatInstallment, isoToDisplayDate } from './format';

describe('isoToDisplayDate', () => {
  it('convierte ISO a DD/MM/YYYY', () => {
    expect(isoToDisplayDate('2026-05-21')).toBe('21/05/2026');
  });
  it('devuelve "" ante entrada inválida o vacía', () => {
    expect(isoToDisplayDate('')).toBe('');
    expect(isoToDisplayDate('21/05/2026')).toBe('');
    expect(isoToDisplayDate(null)).toBe('');
  });
});

describe('displayToIsoDate', () => {
  it('convierte DD/MM/YYYY a ISO', () => {
    expect(displayToIsoDate('21/05/2026')).toBe('2026-05-21');
  });
  it('devuelve "" ante formato inválido o fecha inexistente', () => {
    expect(displayToIsoDate('2026-05-21')).toBe('');
    expect(displayToIsoDate('31/02/2026')).toBe('');
    expect(displayToIsoDate('00/05/2026')).toBe('');
    expect(displayToIsoDate('')).toBe('');
  });
  it('hace roundtrip con isoToDisplayDate', () => {
    expect(displayToIsoDate(isoToDisplayDate('2026-12-31'))).toBe('2026-12-31');
  });
});

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
