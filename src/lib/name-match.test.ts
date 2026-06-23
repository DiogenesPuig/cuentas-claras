import { describe, expect, it } from 'vitest';
import { normalizeNameKey } from './name-match';

describe('normalizeNameKey', () => {
  it('da la misma clave sin importar el orden de las palabras', () => {
    expect(normalizeNameKey('Pérez Juan')).toBe(normalizeNameKey('Juan Perez'));
  });

  it('ignora tildes', () => {
    expect(normalizeNameKey('José Pérez')).toBe(normalizeNameKey('Jose Perez'));
  });

  it('distingue nombres realmente distintos', () => {
    expect(normalizeNameKey('Ana Gómez')).not.toBe(normalizeNameKey('Beto López'));
  });

  it('nulo o vacío da clave vacía', () => {
    expect(normalizeNameKey(null)).toBe('');
    expect(normalizeNameKey('')).toBe('');
  });
});
