import { describe, expect, it } from 'vitest';
import { formatMonthLabel, shiftMonth } from './useActiveMonth';

describe('shiftMonth', () => {
  it('avanza y retrocede dentro del mismo año', () => {
    expect(shiftMonth('2026-06', 1)).toBe('2026-07');
    expect(shiftMonth('2026-06', -1)).toBe('2026-05');
  });

  it('cruza el límite de año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('formatMonthLabel', () => {
  it('devuelve mes y año capitalizados en español', () => {
    expect(formatMonthLabel('2026-06')).toBe('Junio 2026');
    expect(formatMonthLabel('2026-01')).toBe('Enero 2026');
  });
});
