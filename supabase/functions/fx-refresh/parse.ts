// Lógica PURA de parseo de la respuesta de dolarapi. Sin imports de Deno ni de
// red, para poder testearla con vitest (Node). El entrypoint `index.ts` la usa.

/** Fila lista para upsert en `fx_rates` (espejo de la tabla, sin id/created_at). */
export interface FxRateRow {
  date: string; // YYYY-MM-DD
  source: 'dolarapi';
  quote: string; // 'oficial' | 'blue' | 'mep'
  currency: string; // ISO-4217, ej. 'USD'
  buy: number | null; // compra
  sell: number | null; // venta
}

/** Ítem de `GET https://dolarapi.com/v1/dolares` (solo los campos que usamos). */
export interface DolarApiItem {
  casa: string; // 'oficial' | 'blue' | 'bolsa' | 'contadoconliqui' | 'mayorista' | ...
  moneda?: string; // 'USD'
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string; // ISO-8601
}

/**
 * Mapa `casa` (nomenclatura de dolarapi) → `quote` (la de `workspaces.fx_quote`).
 * Solo incluimos las cotizaciones que la app ofrece; el resto se ignora.
 * Nota: dolarapi llama "bolsa" a lo que la app llama "mep".
 */
const CASA_TO_QUOTE: Record<string, string> = {
  oficial: 'oficial',
  blue: 'blue',
  bolsa: 'mep',
};

/**
 * Transforma el payload de dolarapi en filas para `fx_rates`. Tolerante a datos
 * inesperados: si el payload no es un array, devuelve `[]`; ignora ítems de casas
 * que la app no usa o sin fecha válida.
 */
export function parseDolarApi(payload: unknown): FxRateRow[] {
  if (!Array.isArray(payload)) return [];

  const rows: FxRateRow[] = [];
  for (const raw of payload) {
    const item = raw as DolarApiItem;
    const quote = CASA_TO_QUOTE[item?.casa];
    if (!quote) continue;

    const date = toIsoDate(item.fechaActualizacion);
    if (!date) continue;

    rows.push({
      date,
      source: 'dolarapi',
      quote,
      currency: (item.moneda ?? 'USD').toUpperCase(),
      buy: numberOrNull(item.compra),
      sell: numberOrNull(item.venta),
    });
  }
  return rows;
}

/** Trunca un timestamp ISO al día `YYYY-MM-DD`; `null` si no es parseable. */
function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
