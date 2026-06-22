import { describe, expect, it } from 'vitest';
import { normalizeDescription, statementExternalHash } from './dedupe';

describe('normalizeDescription', () => {
  it('saca acentos, pasa a mayúsculas y colapsa espacios', () => {
    expect(normalizeDescription('  Café   con  Leche ')).toBe('CAFE CON LECHE');
    expect(normalizeDescription(null)).toBe('');
  });
});

describe('statementExternalHash', () => {
  const base = {
    last4: '1234',
    occurredOn: '2026-05-15',
    amount: 6099,
    ref: '006532',
    description: 'COMERCIO UNO',
  };

  it('mismas entradas → misma clave (idempotente)', () => {
    expect(statementExternalHash(base)).toBe(statementExternalHash({ ...base }));
  });

  it('el comprobante distingue dos compras iguales (mismo día/monto/comercio)', () => {
    const a = { ...base, ref: '006218' };
    const b = { ...base, ref: '006364' };
    expect(statementExternalHash(a)).not.toBe(statementExternalHash(b));
  });

  it('sin comprobante, cae a la descripción normalizada', () => {
    const a = { last4: '1', occurredOn: '2026-01-01', amount: 10, description: 'Kiosco' };
    const b = { last4: '1', occurredOn: '2026-01-01', amount: 10, description: 'KIOSCO' };
    expect(statementExternalHash(a)).toBe(statementExternalHash(b));
  });

  it('distingue por monto, fecha y cuota', () => {
    expect(statementExternalHash(base)).not.toBe(statementExternalHash({ ...base, amount: 6100 }));
    expect(statementExternalHash(base)).not.toBe(
      statementExternalHash({ ...base, occurredOn: '2026-05-16' }),
    );
    expect(statementExternalHash({ ...base, installmentN: 1, installmentTotal: 3 })).not.toBe(
      statementExternalHash({ ...base, installmentN: 2, installmentTotal: 3 }),
    );
  });
});
