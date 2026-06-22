/** Formatea un monto en su moneda original (sin conversión). */
export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * Formatea la metadata de cuotas de un movimiento como "Cuota N/M".
 * Devuelve `null` cuando el movimiento no es en cuotas (campos en null) o los
 * datos son incompletos/incoherentes, para que el llamador simplemente no lo muestre.
 */
export function formatInstallment(
  n: number | null | undefined,
  total: number | null | undefined,
): string | null {
  if (n == null || total == null) return null;
  if (!Number.isInteger(n) || !Number.isInteger(total)) return null;
  if (n < 1 || total < 1 || n > total) return null;
  return `Cuota ${n}/${total}`;
}
