import { describe, expect, it } from 'vitest';
import { suggestCategory, type SuggestableCategory } from './category-suggest';

// Categorías como las del seed (B6).
const CATS: SuggestableCategory[] = [
  { id: 'super', name: 'Supermercado' },
  { id: 'transp', name: 'Transporte' },
  { id: 'salud', name: 'Salud' },
  { id: 'resto', name: 'Restaurantes' },
  { id: 'compras', name: 'Compras' },
  { id: 'servicios', name: 'Servicios' },
];

describe('suggestCategory', () => {
  it('sugiere por comercio conocido (case/acento-insensitive)', () => {
    expect(suggestCategory('UBER *TRIP', CATS)?.id).toBe('transp');
    expect(suggestCategory('Carrefour Express', CATS)?.id).toBe('super');
    expect(suggestCategory('FARMACITY S.A.', CATS)?.id).toBe('salud');
    expect(suggestCategory('MOD*CARREFOUR CBA', CATS)?.id).toBe('super');
  });

  it('mapea gastronomía a la categoría que exista (Restaurantes o Comida)', () => {
    expect(suggestCategory('PEDIDOSYA', CATS)?.id).toBe('resto');
    const conComida: SuggestableCategory[] = [{ id: 'comida', name: 'Comida' }];
    expect(suggestCategory('mcdonalds palermo', conComida)?.id).toBe('comida');
  });

  it('no sugiere para descripciones desconocidas (no rompe)', () => {
    expect(suggestCategory('TRANSFERENCIA 0923093600201', CATS)).toBeNull();
    expect(suggestCategory('', CATS)).toBeNull();
    expect(suggestCategory(null, CATS)).toBeNull();
  });

  it('devuelve null si la categoría destino no existe en el workspace', () => {
    const soloSuper: SuggestableCategory[] = [{ id: 'super', name: 'Supermercado' }];
    expect(suggestCategory('UBER', soloSuper)).toBeNull();
  });

  it('elige la keyword más específica ante varias coincidencias', () => {
    // "mercado libre" (Compras) es más largo/específico que "libre" suelto; y supera
    // a una coincidencia incidental corta. Verifica el desempate por longitud.
    expect(suggestCategory('MERCADO LIBRE * Cil', CATS)?.id).toBe('compras');
  });
});
