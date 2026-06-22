/** Formatea un monto en su moneda original (sin conversión). */
export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** ISO `YYYY-MM-DD` → display `DD/MM/YYYY`. Devuelve '' si la entrada no es ISO. */
export function isoToDisplayDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Display `DD/MM/YYYY` → ISO `YYYY-MM-DD`. Devuelve '' si el formato es inválido o
 * la fecha no existe (ej. 31/02). Pensado para validar y para convertir al guardar.
 */
export function displayToIsoDate(value: string | null | undefined): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value ?? '').trim());
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00`);
  // Roundtrip: descarta fechas inexistentes (31/02, mes 13, etc.).
  if (Number.isNaN(d.getTime()) || d.getMonth() + 1 !== Number(mm) || d.getDate() !== Number(dd)) {
    return '';
  }
  return iso;
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
