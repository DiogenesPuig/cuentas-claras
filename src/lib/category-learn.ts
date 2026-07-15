/**
 * Memoria de categorías aprendida del **historial** (MEJ-17 + MEJ-18): "poner la misma categoría a lo
 * recurrente". Sin tabla ni migración — se autoentrena con los movimientos ya categorizados.
 *
 * Aprende por dos claves:
 *  - **comercio**: `normalizeMerchant(description)` (ej. "marcoskiosco" → Kiosco).
 *  - **persona**: `owner_member_id`, PERO solo en transferencias/efectivo (ahí la persona es la
 *    contraparte, ej. el alquiler que le transferís siempre a la misma persona → Alquiler). En una
 *    tarjeta la persona es el dueño de la tarjeta, no dice nada de la categoría, así que no cuenta.
 *
 * La sugerencia aprendida gana sobre las keywords fijas (`category-suggest`), y el comercio manda
 * sobre la persona. Pura y testeable: no conoce Supabase ni React.
 */

import { normalizeMerchant } from './category-suggest';

export interface CategoryHistoryRow {
  description: string | null;
  ownerMemberId: string | null;
  /** Tipo del medio del movimiento (para aplicar la clave-persona solo en transfer/cash). */
  accountType: string | null;
  categoryId: string | null;
}

/** Índice aprendido: clave (`merchant:…` | `member:…`) → `categoryId` más usado. */
export type CategoryMemory = ReadonlyMap<string, string>;

const TRANSFER_CASH = new Set(['transfer', 'cash']);

function merchantKey(description: string | null | undefined): string | null {
  const key = normalizeMerchant(description);
  return key ? `merchant:${key}` : null;
}

function memberKey(
  ownerMemberId: string | null | undefined,
  accountType: string | null | undefined,
): string | null {
  if (!ownerMemberId || !accountType || !TRANSFER_CASH.has(accountType)) return null;
  return `member:${ownerMemberId}`;
}

interface LearnInput {
  description?: string | null;
  ownerMemberId?: string | null;
  accountType?: string | null;
}

function keysOf(row: LearnInput): string[] {
  return [merchantKey(row.description), memberKey(row.ownerMemberId, row.accountType)].filter(
    (k): k is string => k !== null,
  );
}

/**
 * Arma la memoria desde el historial: por cada clave, la categoría **más usada**. Desempate: la más
 * **reciente** (se asume `rows` en orden cronológico ascendente), para que una corrección reciente
 * gane un empate.
 */
export function buildCategoryMemory(rows: readonly CategoryHistoryRow[]): CategoryMemory {
  const counts = new Map<string, Map<string, { n: number; last: number }>>();
  rows.forEach((row, i) => {
    if (!row.categoryId) return;
    for (const key of keysOf(row)) {
      const byCat = counts.get(key) ?? new Map<string, { n: number; last: number }>();
      const cur = byCat.get(row.categoryId) ?? { n: 0, last: -1 };
      byCat.set(row.categoryId, { n: cur.n + 1, last: i });
      counts.set(key, byCat);
    }
  });

  const memory = new Map<string, string>();
  for (const [key, byCat] of counts) {
    let best: string | null = null;
    let bestN = 0;
    let bestLast = -1;
    for (const [categoryId, { n, last }] of byCat) {
      if (n > bestN || (n === bestN && last > bestLast)) {
        best = categoryId;
        bestN = n;
        bestLast = last;
      }
    }
    if (best) memory.set(key, best);
  }
  return memory;
}

/**
 * Categoría aprendida para un movimiento en curso (el comercio manda sobre la persona). `null` si no
 * hay memoria. El caller decide si esa categoría todavía existe en el workspace.
 */
export function learnedCategoryId(input: LearnInput, memory: CategoryMemory): string | null {
  const mk = merchantKey(input.description);
  if (mk) {
    const found = memory.get(mk);
    if (found) return found;
  }
  const pk = memberKey(input.ownerMemberId, input.accountType);
  if (pk) {
    const found = memory.get(pk);
    if (found) return found;
  }
  return null;
}
