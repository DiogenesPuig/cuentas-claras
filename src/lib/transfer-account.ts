/**
 * Atribución del medio/persona en un comprobante de transferencia (F2-9, decisión
 * de la charla 2026-06-23): el lado "dueño" depende del tipo de movimiento —
 * en un **gasto** es el **origen** (quien envía); en un **ingreso**, el **destino**
 * (quien recibe). La contraparte (el otro lado) sirve como descripción sugerida.
 * Lógica PURA y testeable: no conoce React ni el `TransactionType` de la DB.
 */

import { accountsToMatchable, matchAccount, type AccountLike } from './account-match';

export type TransferType = 'expense' | 'income';
export type TransferSide = 'origin' | 'dest';

export interface TransferPartyInfo {
  originHolder: string | null;
  originBank: string | null;
  destHolder: string | null;
  destBank: string | null;
}

/** Lado dueño del medio según el tipo: gasto → origen, ingreso → destino. */
export function ownerSideFor(type: TransferType): TransferSide {
  return type === 'expense' ? 'origin' : 'dest';
}

export function holderFor(info: TransferPartyInfo, side: TransferSide): string | null {
  return side === 'origin' ? info.originHolder : info.destHolder;
}

export function bankFor(info: TransferPartyInfo, side: TransferSide): string | null {
  return side === 'origin' ? info.originBank : info.destBank;
}

/** El otro lado de `side`: sirve como descripción sugerida del movimiento. */
export function counterpartyFor(info: TransferPartyInfo, side: TransferSide): string | null {
  return side === 'origin' ? info.destHolder : info.originHolder;
}

/** Forma mínima de un medio `'transfer'` para buscarlo por miembro o por titular. */
export interface TransferAccountLike extends AccountLike {
  owner_member_id: string | null;
}

/**
 * Medio `'transfer'` de una persona entre los medios del workspace (F2-11): un único
 * medio por persona, no por persona+banco.
 *
 * Prioridad:
 * 1. Por `owner_member_id`, si el titular matchea a un miembro (vínculo fuerte).
 * 2. **BUG-8:** si el miembro todavía no tiene un medio vinculado por `owner_member_id`
 *    (ej. el medio se creó por nombre antes de que esa persona fuera miembro), NO se
 *    devuelve `null`: se cae al match fuzzy por `holder_name` para **reusar** ese medio
 *    en vez de duplicarlo.
 * 3. Si no hay member match, directamente el match fuzzy por `holder_name`.
 *
 * Pura y testeable: opera sobre una forma mínima (no conoce el `Account` de la DB).
 */
export interface TransferAccountMatch<T> {
  /** Único medio que matchea con confianza → se asocia directo. */
  matched: T | null;
  /** Medios parecidos (overlap parcial de titular) → candidatos a "¿es la misma persona?" (MEJ-4A). */
  candidates: T[];
}

/**
 * Igual que `findTransferAccount` pero devolviendo también los **candidatos** parecidos cuando no
 * hay match fuerte (MEJ-4A): sirve para ofrecer el prompt inline "¿es la misma persona que <X>?"
 * antes de crear un medio nuevo, y sumar el nombre detectado como alias si el usuario confirma.
 */
export function matchTransferAccount<T extends TransferAccountLike>(
  holder: string | null,
  matchedMemberId: string | null,
  transferAccounts: readonly T[],
): TransferAccountMatch<T> {
  if (!holder) return { matched: null, candidates: [] };
  if (matchedMemberId) {
    const byMember = transferAccounts.find((a) => a.owner_member_id === matchedMemberId);
    if (byMember) return { matched: byMember, candidates: [] };
    // Sin medio vinculado al miembro → seguir al match fuzzy por titular (BUG-8).
  }
  const matchable = accountsToMatchable(transferAccounts);
  const result = matchAccount(
    { bank: null, network: null, last4: null, holder },
    matchable,
    { allowHolderOnlyMatch: true },
  );
  const byId = (id: string): T | null => transferAccounts.find((a) => a.id === id) ?? null;
  return {
    matched: result.matched ? byId(result.matched.id) : null,
    candidates: result.candidates.map((c) => byId(c.id)).filter((a): a is T => a != null),
  };
}

export function findTransferAccount<T extends TransferAccountLike>(
  holder: string | null,
  matchedMemberId: string | null,
  transferAccounts: readonly T[],
): T | null {
  return matchTransferAccount(holder, matchedMemberId, transferAccounts).matched;
}

export interface TransferAccountDefaults {
  name: string;
  holderName: string;
}

/**
 * Valores para precargar el alta (lazy) del medio `'transfer'` del lado dueño (F2-11).
 * Un único medio por persona, sin banco (el banco vive en `transactions.bank`); por
 * eso el nombre es siempre genérico, no incluye el banco del comprobante.
 */
export function transferAccountDefaults(holder: string | null): TransferAccountDefaults {
  return {
    name: 'Transferencia',
    holderName: holder ?? '',
  };
}
