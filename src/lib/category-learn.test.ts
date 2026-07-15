import { describe, expect, it } from 'vitest';
import { buildCategoryMemory, learnedCategoryId, type CategoryHistoryRow } from './category-learn';

const H = (
  description: string | null,
  categoryId: string | null,
  ownerMemberId: string | null = null,
  accountType: string | null = 'credit',
): CategoryHistoryRow => ({ description, ownerMemberId, accountType, categoryId });

describe('buildCategoryMemory / learnedCategoryId', () => {
  it('aprende la categoría de un comercio y la sugiere (case/acento-insensitive)', () => {
    const mem = buildCategoryMemory([H('MarcosKiosco', 'kiosco'), H('marcos kiosco 24hs', 'kiosco')]);
    expect(learnedCategoryId({ description: 'MARCOSKIOSCO' }, mem)).toBe('kiosco');
  });

  it('usa la categoría MÁS usada; desempata por la más reciente', () => {
    // 'ypf' 2× Auto, 1× Otros → gana Auto (match por clave normalizada exacta).
    const mem = buildCategoryMemory([H('YPF', 'auto'), H('ypf', 'auto'), H('Ypf', 'otros')]);
    expect(learnedCategoryId({ description: 'YPF' }, mem)).toBe('auto');
    // Empate 1-1 → gana la más reciente (la última del array).
    const tie = buildCategoryMemory([H('Bar Central', 'ocio'), H('bar central', 'resto')]);
    expect(learnedCategoryId({ description: 'BAR CENTRAL' }, tie)).toBe('resto');
  });

  it('aprende por persona SOLO en transferencia/efectivo (el alquiler a la misma persona)', () => {
    const mem = buildCategoryMemory([
      H(null, 'alquiler', 'm-juan', 'transfer'),
      H('varios', 'alquiler', 'm-juan', 'transfer'),
    ]);
    expect(learnedCategoryId({ ownerMemberId: 'm-juan', accountType: 'transfer' }, mem)).toBe('alquiler');
  });

  it('la persona NO cuenta en tarjetas (ahí es el dueño de la tarjeta, no la categoría)', () => {
    const mem = buildCategoryMemory([
      H('super chino', 'super', 'm-dio', 'credit'),
      H('farmacia', 'salud', 'm-dio', 'credit'),
    ]);
    // No hay memoria por persona para tarjetas → null (aunque el comercio sí se aprende aparte).
    expect(learnedCategoryId({ ownerMemberId: 'm-dio', accountType: 'credit' }, mem)).toBeNull();
    expect(learnedCategoryId({ description: 'SUPER CHINO' }, mem)).toBe('super');
  });

  it('el comercio manda sobre la persona', () => {
    const mem = buildCategoryMemory([
      H('mercado pago*luz', 'servicios', 'm-x', 'transfer'), // comercio → Servicios
      H(null, 'alquiler', 'm-x', 'transfer'), // persona → Alquiler
    ]);
    expect(learnedCategoryId({ description: 'Mercado Pago*Luz', ownerMemberId: 'm-x', accountType: 'transfer' }, mem)).toBe('servicios');
  });

  it('sin historial / sin match → null', () => {
    const mem = buildCategoryMemory([]);
    expect(learnedCategoryId({ description: 'lo que sea' }, mem)).toBeNull();
    expect(learnedCategoryId({ description: '' }, buildCategoryMemory([H('algo', 'x')]))).toBeNull();
  });
});
