import { shiftMonth } from '@/hooks/useActiveMonth';

/** Filtros de la pantalla de movimientos (FR-11): mes, persona, tarjeta, categoría, moneda y texto. */
export interface TransactionFilters {
  month?: string;
  accountId?: string;
  categoryId?: string;
  currency?: string;
  holderName?: string;
  search?: string;
}

/** Argumentos ya normalizados para armar la query de Supabase (rango de fechas, texto recortado). */
/** Filtros de campo de la lista (sin mes ni texto, que se manejan aparte en `TransactionsPage`). */
export type FieldFilters = Omit<TransactionFilters, 'month' | 'search'>;

export const EMPTY_FIELD_FILTERS: FieldFilters = {
  accountId: '',
  categoryId: '',
  currency: '',
  holderName: '',
};

export interface TransactionFilterArgs {
  occurredFrom?: string;
  occurredTo?: string;
  accountId?: string;
  categoryId?: string;
  currency?: string;
  holderName?: string;
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
  if (filters.accountId) args.accountId = filters.accountId;
  if (filters.categoryId) args.categoryId = filters.categoryId;
  if (filters.currency?.length === 3) args.currency = filters.currency;
  if (filters.holderName) args.holderName = filters.holderName;

  const search = filters.search?.trim();
  if (search) args.search = escapeLike(search);

  return args;
}
