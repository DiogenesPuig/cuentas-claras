/** Forma mínima de un medio para etiquetarlo (subconjunto de `Account`). */
interface AccountLike {
  name: string;
  bank: string | null;
  network: string | null;
  last4: string | null;
}

const NETWORK_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Master',
  amex: 'Amex',
  cabal: 'Cabal',
  other: 'Otra',
};

/**
 * Etiqueta de un medio para los combos de selección: muestra banco · red · últimos 4
 * además del nombre, para distinguir tarjetas (ej. al asignar el medio de un resumen).
 * Los campos ausentes se omiten.
 */
export function accountLabel(account: AccountLike): string {
  const parts = [
    account.bank,
    account.network ? (NETWORK_LABELS[account.network] ?? account.network) : null,
    account.last4 ? `••${account.last4}` : null,
  ].filter(Boolean);
  return parts.length ? `${account.name} — ${parts.join(' · ')}` : account.name;
}
