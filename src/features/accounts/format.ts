/** Forma mínima de un medio para etiquetarlo (subconjunto de `Account`). */
interface AccountLike {
  name: string;
  bank: string | null;
  network: string | null;
  last4: string | null;
  /** Dueño de la tarjeta (`holder_name`); se muestra abreviado para distinguir titular/extensión. */
  holderName?: string | null;
}

/** Largo del nombre del dueño que se muestra en la etiqueta (las primeras N letras). */
const HOLDER_PREFIX_LEN = 5;

const NETWORK_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Master',
  amex: 'Amex',
  cabal: 'Cabal',
  other: 'Otra',
};

/**
 * Etiqueta de un medio para los combos de selección: **banco · red · ••últimos4 · (Nombr)**,
 * donde `(Nombr)` son las primeras letras del dueño de la tarjeta (para distinguir titular de
 * extensión cuando comparten banco/red). Si no hay ninguno de los datos de tarjeta (ej.
 * efectivo/billetera), cae al nombre del medio.
 */
export function accountLabel(account: AccountLike): string {
  const parts = [
    account.bank,
    account.network ? (NETWORK_LABELS[account.network] ?? account.network) : null,
    account.last4 ? `••${account.last4}` : null,
  ].filter(Boolean);
  const holder = account.holderName?.trim();
  // El nombre del dueño solo acompaña a una tarjeta identificable (no a "Efectivo").
  if (parts.length && holder) parts.push(`(${holder.slice(0, HOLDER_PREFIX_LEN)})`);
  return parts.length ? parts.join(' · ') : account.name;
}
