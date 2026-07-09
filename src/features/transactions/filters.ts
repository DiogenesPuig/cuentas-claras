import { shiftMonth } from '@/hooks/useActiveMonth';

/**
 * Filtros de la pantalla de movimientos que se aplican en la query de Supabase (FR-11): mes, medio,
 * categoría, moneda y texto. El filtro por **persona** NO va acá: se resuelve en el cliente
 * (`personaKeyOf`), porque la persona sale de varias capas (movimiento → medio → holder).
 */
export interface TransactionFilters {
  month?: string;
  accountId?: string;
  categoryId?: string;
  currency?: string;
  search?: string;
}

/**
 * Valor centinela del filtro de medio para "movimientos SIN medio" (BUG-13): se distingue del
 * "todos" (`''`) y de un id de medio real. Mapea a `account_id IS NULL` en la query.
 */
export const NO_ACCOUNT_FILTER = '__no_account__';

/**
 * Filtros de campo de la lista (sin mes ni texto, que se manejan aparte en `TransactionsPage`).
 * `personaKey` es client-side (IDENT-1): una `personaKeyOf(...)` (`member:<id>` | `name:<n>` |
 * "Sin medio"), no viaja a la query.
 */
export interface FieldFilters {
  accountId?: string;
  categoryId?: string;
  currency?: string;
  personaKey?: string;
}

export const EMPTY_FIELD_FILTERS: FieldFilters = {
  accountId: '',
  categoryId: '',
  currency: '',
  personaKey: '',
};

/** Argumentos ya normalizados para armar la query de Supabase (rango de fechas, texto recortado). */
export interface TransactionFilterArgs {
  occurredFrom?: string;
  occurredTo?: string;
  accountId?: string;
  /** Movimientos sin medio asociado (`account_id IS NULL`), BUG-13. */
  accountIsNull?: boolean;
  categoryId?: string;
  currency?: string;
  search?: string;
}

/**
 * Escapa los comodines de `LIKE`/`ILIKE` (`%`, `_` y la propia `\`) para que el
 * texto de búsqueda se interprete literal y no como patrón. El patrón final
 * (`%texto%`) lo arma `api.listTransactions`; acá solo neutralizamos lo que tipea
 * el usuario.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Mapea los filtros de la UI a los argumentos de la query (`api.listTransactions`).
 * Pura y testeable sin Supabase: el mes se convierte en un rango `[from, to)`
 * (`to` exclusivo, primer día del mes siguiente) para usar `.gte/.lt` en `occurred_on`.
 * La moneda solo se aplica con el código completo de 3 letras, para no disparar
 * queries (con 0 resultados) mientras el usuario todavía la está tipeando.
 */
export function buildTransactionFilterArgs(filters: TransactionFilters): TransactionFilterArgs {
  const args: TransactionFilterArgs = {};

  if (filters.month) {
    args.occurredFrom = `${filters.month}-01`;
    args.occurredTo = `${shiftMonth(filters.month, 1)}-01`;
  }
  if (filters.accountId === NO_ACCOUNT_FILTER) args.accountIsNull = true;
  else if (filters.accountId) args.accountId = filters.accountId;
  if (filters.categoryId) args.categoryId = filters.categoryId;
  if (filters.currency?.length === 3) args.currency = filters.currency;

  const search = filters.search?.trim();
  if (search) args.search = escapeLike(search);

  return args;
}
