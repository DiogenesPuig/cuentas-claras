import { describe, expect, it } from 'vitest';
import { parseDolarApi } from './parse';

// Payload representativo de GET https://dolarapi.com/v1/dolares (recortado a los
// campos que usamos). Incluye casas que la app usa y otras que ignora.
const SAMPLE = [
  {
    casa: 'oficial',
    moneda: 'USD',
    compra: 1175.5,
    venta: 1215.5,
    fechaActualizacion: '2026-06-21T17:55:00.000Z',
  },
  {
    casa: 'blue',
    moneda: 'USD',
    compra: 1190,
    venta: 1210,
    fechaActualizacion: '2026-06-21T18:00:00.000Z',
  },
  {
    casa: 'bolsa', // MEP en la nomenclatura de dolarapi
    moneda: 'USD',
    compra: 1200.25,
    venta: 1205.75,
    fechaActualizacion: '2026-06-21T18:01:00.000Z',
  },
  {
    casa: 'cripto', // no la usa la app → se ignora
    moneda: 'USD',
    compra: 1300,
    venta: 1320,
    fechaActualizacion: '2026-06-21T18:02:00.000Z',
  },
];

describe('parseDolarApi', () => {
  it('mapea solo las casas que usa la app y traduce bolsa→mep', () => {
    const rows = parseDolarApi(SAMPLE);
    expect(rows.map((r) => r.quote)).toEqual(['oficial', 'blue', 'mep']);
  });

  it('guarda compra y venta, y trunca la fecha al día', () => {
    const [oficial] = parseDolarApi(SAMPLE);
    expect(oficial).toEqual({
      date: '2026-06-21',
      source: 'dolarapi',
      quote: 'oficial',
      currency: 'USD',
      buy: 1175.5,
      sell: 1215.5,
    });
  });

  it('USD por defecto cuando falta `moneda`, y lo normaliza a mayúsculas', () => {
    const rows = parseDolarApi([
      { casa: 'oficial', compra: 1, venta: 2, fechaActualizacion: '2026-06-21T00:00:00Z' },
      { casa: 'blue', moneda: 'usd', compra: 1, venta: 2, fechaActualizacion: '2026-06-21T00:00:00Z' },
    ]);
    expect(rows.map((r) => r.currency)).toEqual(['USD', 'USD']);
  });

  it('tolera compra/venta nulos o ausentes', () => {
    const [row] = parseDolarApi([
      { casa: 'oficial', moneda: 'USD', compra: null, fechaActualizacion: '2026-06-21T00:00:00Z' },
    ]);
    expect(row.buy).toBeNull();
    expect(row.sell).toBeNull();
  });

  it('ignora ítems sin fecha válida', () => {
    const rows = parseDolarApi([
      { casa: 'oficial', moneda: 'USD', compra: 1, venta: 2, fechaActualizacion: 'no-es-fecha' },
    ]);
    expect(rows).toEqual([]);
  });

  it('payload que no es array → []', () => {
    expect(parseDolarApi(null)).toEqual([]);
    expect(parseDolarApi({})).toEqual([]);
    expect(parseDolarApi('x')).toEqual([]);
  });
});
