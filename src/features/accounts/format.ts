/** Forma mínima de un medio para etiquetarlo (subconjunto de `Account`). */
interface AccountLike {
  name: string;
  bank: string | null;
  network: string | null;
  last4: string | null;
  /** Dueño de la tarjeta (`holder_name`); se muestra abreviado para distinguir titular/extensión. */
  holderName?: string | null;
  /** F2-11: el medio `'transfer'` es siempre genérico ("Transferencia"), sin banco/red/last4
   * que lo distinga; el dueño es la única forma de diferenciar el de cada persona. */
  type?: string;
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
  const cardParts = [
    account.bank,
    account.network ? (NETWORK_LABELS[account.network] ?? account.network) : null,
    account.last4 ? `••${account.last4}` : null,
  ].filter(Boolean);
  const holder = account.holderName?.trim();

  // El nombre del dueño solo acompaña a una tarjeta identificable (no a "Efectivo").
  if (cardParts.length) {
    if (holder) cardParts.push(`(${holder.slice(0, HOLDER_PREFIX_LEN)})`);
    return cardParts.join(' · ');
  }

  // Excepción (F2-11): el medio `'transfer'` no tiene datos de tarjeta, así que sin el
  // dueño todas las personas verían el mismo "Transferencia" en el combo.
  if (holder && account.type === 'transfer') {
    return `${account.name} (${holder.slice(0, HOLDER_PREFIX_LEN)})`;
  }
  return account.name;
}

/**
 * Nombre de un medio para listas/filtros que muestran el `name` crudo (BUG-14). El `name` de un
 * medio creado desde un resumen queda "congelado" (ej. "mastercard ••1234" sin banco si el banco
 * no se reconoció); si después se le edita el banco, el `name` no se regenera. Acá anteponemos el
 * banco cuando está seteado y el nombre no lo incluye ya, para que el banco editado se vea sin
 * pisar nombres personalizados que ya lo contienen.
 */
export function accountDisplayName(account: { name: string; bank: string | null }): string {
  const bank = account.bank?.trim();
  if (bank && !account.name.toLowerCase().includes(bank.toLowerCase())) {
    return `${bank} · ${account.name}`;
  }
  return account.name;
}
