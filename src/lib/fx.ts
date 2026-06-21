import { billingPeriodFor } from './billing';

/** Fila de cotización (espejo de `fx_rates`), sin tocar Supabase. */
export interface FxRateRow {
  /** `YYYY-MM-DD`. */
  date: string;
  currency: string;
  /** Cotización de venta; es la que se usa para valuar gastos en moneda extranjera. */
  sell: number | null;
}

/** Cotizaciones de una moneda, ordenadas por fecha ascendente. */
type RateSeries = { date: string; sell: number }[];

/** Índice por moneda de las cotizaciones disponibles, para buscar la vigente a una fecha. */
export type FxRateIndex = Map<string, RateSeries>;

/** Arma el índice a partir de las filas crudas de `fx_rates` (descarta `sell` nulo). */
export function buildRateIndex(rows: FxRateRow[]): FxRateIndex {
  const index: FxRateIndex = new Map();
  for (const row of rows) {
    if (row.sell === null) continue;
    const series = index.get(row.currency) ?? [];
    series.push({ date: row.date, sell: row.sell });
    index.set(row.currency, series);
  }
  for (const series of index.values()) {
    series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return index;
}

/**
 * Cotización (`sell`) de `currency` vigente a `date`: la más reciente con
 * fecha `<= date`. `undefined` si no hay ninguna cotización a esa fecha o antes
 * (p. ej. el cron de C12 todavía no tenía historial para ese día).
 */
export function lookupRate(index: FxRateIndex, currency: string, date: string): number | undefined {
  const series = index.get(currency);
  if (!series || series.length === 0) return undefined;

  let result: number | undefined;
  for (const entry of series) {
    if (entry.date > date) break;
    result = entry.sell;
  }
  return result;
}

/** Lo mínimo de un movimiento y su medio que hace falta para resolver la fecha de FX. */
export interface FxDateInput {
  occurredOn: string;
  chargedOn: string | null;
}

export interface FxDateAccount {
  type: string;
  billingCloseDay: number | null;
}

/**
 * Fecha (`YYYY-MM-DD`) que define qué cotización le corresponde a un movimiento en
 * moneda extranjera. En Argentina el FX real depende de cuándo se cobra:
 * 1. Si el movimiento tiene `charged_on` explícito, se respeta tal cual (ya es la
 *    convención del esquema: "base del FX y del ciclo").
 * 2. Si no lo tiene y el medio es una tarjeta de **crédito** con día de cierre, el banco
 *    aplica la cotización del **cierre del ciclo** que contiene `occurred_on` (no la del
 *    día de la compra) — se deriva con `billing.billingPeriodFor` (C11), sin duplicar lógica.
 * 3. En cualquier otro caso (débito, efectivo, billetera, cuenta bancaria, o sin medio),
 *    la conversión es inmediata: se usa `occurred_on` directo.
 *
 * Nota: hasta que exista importación de resúmenes (Fase 2), esta fecha es una estimación
 * para crédito — el monto real en pesos lo fija el banco al cierre.
 */
export function resolveFxDate(tx: FxDateInput, account: FxDateAccount | null): string {
  if (tx.chargedOn) return tx.chargedOn;
  if (account?.type === 'credit' && account.billingCloseDay) {
    return billingPeriodFor(tx.occurredOn, account.billingCloseDay).end;
  }
  return tx.occurredOn;
}
