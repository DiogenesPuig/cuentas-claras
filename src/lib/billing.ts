/** Rango de un período de facturación, ambos extremos inclusive, `YYYY-MM-DD`. */
export interface BillingPeriod {
  /** Primer día del período (día después del cierre anterior). */
  start: string;
  /** Día de cierre del período. */
  end: string;
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month: month - 1, day };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Día de cierre real de un mes: `closeDay`, recortado al último día si el mes es más corto (ej. cierre 31 en febrero). */
function closingDay(year: number, month: number, closeDay: number): number {
  return Math.min(closeDay, daysInMonth(year, month));
}

/**
 * Período de facturación (FR-6b) al que pertenece `chargedOn`, según el día de
 * cierre de la tarjeta (`closeDay`, 1-31). El día de cierre queda incluido en el
 * período que termina ese día (igual que un resumen real: lo cargado hasta el
 * cierre, inclusive, entra en ese resumen); lo cargado después empieza el ciclo
 * siguiente. Si el mes es más corto que `closeDay` (ej. cierre 31 en febrero),
 * el cierre cae en el último día del mes.
 */
export function billingPeriodFor(chargedOn: string, closeDay: number): BillingPeriod {
  const { year, month, day } = parseDate(chargedOn);
  const closeThisMonth = closingDay(year, month, closeDay);

  const end =
    day <= closeThisMonth
      ? new Date(year, month, closeThisMonth)
      : (() => {
          const next = new Date(year, month + 1, 1);
          return new Date(next.getFullYear(), next.getMonth(), closingDay(next.getFullYear(), next.getMonth(), closeDay));
        })();

  const prev = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  const prevClose = closingDay(prev.getFullYear(), prev.getMonth(), closeDay);
  const start = new Date(prev.getFullYear(), prev.getMonth(), prevClose + 1);

  return { start: formatDate(start), end: formatDate(end) };
}
