import { describe, expect, it } from 'vitest';
import { isInstitutionalPayee } from './payee';

describe('isInstitutionalPayee', () => {
  it('detecta organismos de recaudación', () => {
    expect(isInstitutionalPayee('AFIP')).toBe(true);
    expect(isInstitutionalPayee('ARCA Buenos Aires')).toBe(true);
    expect(isInstitutionalPayee('ARBA')).toBe(true);
    expect(isInstitutionalPayee('AGIP CABA')).toBe(true);
    expect(isInstitutionalPayee('DGR Córdoba')).toBe(true);
    expect(isInstitutionalPayee('Rentas Provinciales')).toBe(true);
    expect(isInstitutionalPayee('Ingresos Brutos ARBA')).toBe(true);
    expect(isInstitutionalPayee('Monotributo Categoría A')).toBe(true);
  });

  it('detecta empresas de servicios públicos', () => {
    expect(isInstitutionalPayee('EDESUR SA')).toBe(true);
    expect(isInstitutionalPayee('Edenor')).toBe(true);
    expect(isInstitutionalPayee('METROGAS SA')).toBe(true);
    expect(isInstitutionalPayee('AYSA')).toBe(true);
    expect(isInstitutionalPayee('Telecom Argentina')).toBe(true);
    expect(isInstitutionalPayee('Movistar Argentina')).toBe(true);
  });

  it('es case/acento-insensitive', () => {
    expect(isInstitutionalPayee('afip')).toBe(true);
    expect(isInstitutionalPayee('Percepción ARBA')).toBe(true);
    expect(isInstitutionalPayee('IMPUESTO SELLOS')).toBe(true);
  });

  it('devuelve false para nombres de persona (no falsos positivos)', () => {
    expect(isInstitutionalPayee('Juan Perez')).toBe(false);
    expect(isInstitutionalPayee('Maria Lopez')).toBe(false);
    expect(isInstitutionalPayee('Carlos García')).toBe(false);
    expect(isInstitutionalPayee('Ana Rodríguez')).toBe(false);
  });

  it('devuelve false para null/vacío', () => {
    expect(isInstitutionalPayee(null)).toBe(false);
    expect(isInstitutionalPayee(undefined)).toBe(false);
    expect(isInstitutionalPayee('')).toBe(false);
  });
});
