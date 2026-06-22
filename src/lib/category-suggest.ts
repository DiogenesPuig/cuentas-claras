/**
 * Sugerencia automática de categoría por descripción/comercio (FR-19). Motor por
 * **reglas de keyword** (puro, sin red ni dependencias): dado un texto y las
 * categorías disponibles, devuelve la más probable o `null`. La sugerencia siempre
 * es editable por el usuario (nunca se aplica sola). IA/embeddings queda fuera (F2-6).
 *
 * Resolución: gana la keyword más específica (más larga) que aparezca como substring,
 * insensible a mayúsculas/acentos. Cada regla apunta a uno o más nombres canónicos de
 * categoría (el primero que exista en el workspace gana), porque el seed puede llamarla
 * "Restaurantes" mientras otro workspace tiene "Comida".
 */

export interface SuggestableCategory {
  id: string;
  name: string;
}

interface Rule {
  /** Nombres canónicos aceptables de la categoría destino (el primero presente gana). */
  category: string[];
  /** Palabras clave (match por substring, case/acento-insensitive). */
  keywords: string[];
}

const RULES: Rule[] = [
  {
    category: ['Transporte'],
    keywords: [
      'uber', 'cabify', 'didi', 'beat', 'ypf', 'shell', 'axion', 'puma energy', 'estacion de servicio',
      'peaje', 'sube', 'subte', 'aerolineas', 'latam', 'flybondi', 'jetsmart', 'despegar', 'remis', 'taxi',
    ],
  },
  {
    category: ['Supermercado'],
    keywords: [
      'carrefour', 'changomas', 'chango mas', 'hipermercado', 'coto', 'jumbo', 'vea', 'disco',
      'la anonima', 'makro', 'dia argentina', 'superm dia', 'supermercado',
    ],
  },
  {
    category: ['Restaurantes', 'Comida', 'Gastronomia'],
    keywords: [
      'pedidosya', 'pedidos ya', 'rappi', 'mcdonald', 'burger king', 'mostaza', 'starbucks', 'cantina',
      'la celeste', 'kfc', 'subway', 'restaurant', 'parrilla', 'heladeria', 'grido', 'havanna',
    ],
  },
  {
    category: ['Compras', 'Kiosco'],
    keywords: [
      'kiosco', 'pilusso', 'maxikiosco', 'mercadolibre', 'mercado libre', 'shopping', 'falabella',
      'garbarino', 'fravega', 'musimundo', 'tienda',
    ],
  },
  {
    category: ['Salud'],
    keywords: ['farmacity', 'farmacia', 'dr ahorro', 'farmaplus', 'hospital', 'clinica', 'sanatorio', 'optica'],
  },
  {
    category: ['Servicios'],
    keywords: [
      'edesur', 'edenor', 'metrogas', 'aysa', 'telecom', 'movistar', 'claro arg', 'personal', 'netflix',
      'spotify', 'directv', 'flow', 'cablevision',
    ],
  },
];

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryNameMatches(available: string, target: string): boolean {
  const a = norm(available);
  const t = norm(target);
  return a === t || a.includes(t);
}

/**
 * Sugiere una categoría para `description` entre las `categories` disponibles.
 * Devuelve la categoría (o `null` si no hay regla que aplique o ninguna categoría
 * destino existe en el workspace). No muta nada; la decisión final es del usuario.
 */
export function suggestCategory<T extends SuggestableCategory>(
  description: string | null | undefined,
  categories: readonly T[],
): T | null {
  const desc = norm(description);
  if (!desc || categories.length === 0) return null;

  // Por cada regla, la longitud de su keyword más larga que matchea (especificidad).
  const matches: { rule: Rule; len: number }[] = [];
  for (const rule of RULES) {
    let bestLen = 0;
    for (const kw of rule.keywords) {
      const nkw = norm(kw);
      if (nkw && desc.includes(nkw)) bestLen = Math.max(bestLen, nkw.length);
    }
    if (bestLen > 0) matches.push({ rule, len: bestLen });
  }
  matches.sort((a, b) => b.len - a.len);

  // De la más específica a la menos, devolver la 1ra cuya categoría destino exista.
  for (const { rule } of matches) {
    for (const name of rule.category) {
      const found = categories.find((c) => categoryNameMatches(c.name, name));
      if (found) return found;
    }
  }
  return null;
}
