/**
 * Clave de deduplicación de movimientos importados (FR-17).
 *
 * Lógica PURA (sin red ni Supabase). Produce el `external_hash` que se guarda en
 * `transactions` y cuyo índice único `(workspace_id, external_hash)` evita importar
 * dos veces el mismo movimiento (mismo resumen subido de nuevo, o un movimiento que
 * reaparece en otro resumen).
 *
 * Identidad de un movimiento de resumen: tarjeta (últimos 4) + fecha + monto + cuota
 * + (nº de comprobante SI está; si no, la descripción normalizada). Incluir el
 * comprobante distingue dos compras legítimamente iguales (mismo día/monto/comercio)
 * que en el resumen tienen comprobantes distintos (criterio de aceptación F2-4).
 */

export interface DedupeFields {
  last4: string | null;
  occurredOn: string | null; // ISO
  amount: number | null;
  installmentN?: number | null;
  installmentTotal?: number | null;
  ref?: string | null;
  description?: string | null;
}

/** Normaliza texto para comparar: sin acentos, mayúsculas, espacios colapsados. */
export function normalizeDescription(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** `external_hash` estable y legible. Mismas entradas → misma clave. */
export function statementExternalHash(fields: DedupeFields): string {
  const last4 = fields.last4 ?? '----';
  const date = fields.occurredOn ?? '';
  const amount = fields.amount != null ? fields.amount.toFixed(2) : '';
  const inst =
    fields.installmentN != null && fields.installmentTotal != null
      ? `${fields.installmentN}/${fields.installmentTotal}`
      : '';
  // El comprobante es la clave más fuerte; si falta, caemos a la descripción.
  const tail = fields.ref ? `#${fields.ref}` : normalizeDescription(fields.description);
  return ['stmt', last4, date, amount, inst, tail].join('|');
}
