import { describe, expect, it } from 'vitest';
import { billingPeriodFor } from './billing';

describe('billingPeriodFor', () => {
  it('cierre a mitad de mes: una fecha antes o en el cierre cae en el período que termina ese mes', () => {
    expect(billingPeriodFor('2026-06-10', 15)).toEqual({ start: '2026-05-16', end: '2026-06-15' });
    expect(billingPeriodFor('2026-06-15', 15)).toEqual({ start: '2026-05-16', end: '2026-06-15' });
  });

  it('cierre a mitad de mes: una fecha después del cierre cae en el período siguiente', () => {
    expect(billingPeriodFor('2026-06-20', 15)).toEqual({ start: '2026-06-16', end: '2026-07-15' });
  });

  it('día de cierre 31 en un mes corto (febrero) se recorta al último día del mes', () => {
    expect(billingPeriodFor('2026-02-20', 31)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('día de cierre 31 en febrero bisiesto se recorta al día 29', () => {
    expect(billingPeriodFor('2028-02-15', 31)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('el período que sigue al cierre recortado de febrero arranca el 1° de marzo', () => {
    expect(billingPeriodFor('2026-03-01', 31)).toEqual({ start: '2026-03-01', end: '2026-03-31' });
  });

  it('día de cierre 1: el propio día 1 cierra el período', () => {
    expect(billingPeriodFor('2026-06-01', 1)).toEqual({ start: '2026-05-02', end: '2026-06-01' });
    expect(billingPeriodFor('2026-06-02', 1)).toEqual({ start: '2026-06-02', end: '2026-07-01' });
  });

  it('borde de fin de año: cierre día 31 en diciembre cruza al año siguiente', () => {
    expect(billingPeriodFor('2026-01-05', 31)).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('borde de fin de año: el período de fin de diciembre arranca y termina en años distintos', () => {
    expect(billingPeriodFor('2026-12-20', 15)).toEqual({ start: '2026-12-16', end: '2027-01-15' });
  });
});
