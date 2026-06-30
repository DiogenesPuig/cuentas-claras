/**
 * Detección de movimientos posiblemente duplicados al dar de alta (F2-13). PURA: sin red
 * ni Supabase. Dada la entrada del alta y una lista de movimientos existentes, devuelve los
 * candidatos parecidos con su **motivo**, para un aviso SUAVE (el usuario decide, nunca se
 * bloquea). Distinto de F2-4 (resúmenes), que es bloqueo duro por `external_hash`.
 *
 * Señales (de más a menos fuerte):
 *  - `same-file`: el comprobante adjunto tiene el MISMO hash de contenido (subiste el mismo archivo).
 *  - `amount-date(-account|-desc)`: mismo monto+moneda y fecha dentro de ±`SIMILAR_DATE_WINDOW_DAYS`;
 *    se refuerza si además coincide el medio o la descripción normalizada.
 */
import { normalizeDescription } from './dedupe';

export type DuplicateReason = 'same-file' | 'amount-date' | 'amount-date-account' | 'amount-date-desc';

/** Ventana de fecha (en días, ±) para considerar dos movimientos "parecidos". */
export const SIMILAR_DATE_WINDOW_DAYS = 2;

export interface DuplicateInput {
  amount: number;
  currency: string;
  occurredOn: string; // ISO YYYY-MM-DD
  accountId: string | null;
  description: string | null;
  /** Hash del comprobante que se está por subir (o null si no hay archivo / no se pudo calcular). */
  contentHash: string | null;
}

/** Forma mínima de un movimiento existente para comparar (la feature le agrega datos de display). */
export interface ExistingTransaction {
  amount: number;
  currency: string;
  occurred_on: string;
  account_id: string | null;
  description: string | null;
  /** Hash del comprobante adjunto de ESE movimiento (o null si no tiene). */
  attachmentContentHash: string | null;
}

export interface DuplicateCandidate<T> {
  tx: T;
  reason: DuplicateReason;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005; // tolerancia de centavo (evita ruido de float)
}

function daysApart(isoA: string, isoB: string): number {
  const a = Date.parse(`${isoA}T00:00:00Z`);
  const b = Date.parse(`${isoB}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.abs(a - b) / 86_400_000;
}

/**
 * Candidatos a duplicado de `input` entre `existing`, con su motivo. Ordena los `same-file`
 * primero (señal más fuerte) y, dentro de cada grupo, por cercanía de fecha. No muta nada;
 * la decisión final (guardar igual / cancelar) es del usuario.
 */
export function findDuplicates<T extends ExistingTransaction>(
  input: DuplicateInput,
  existing: readonly T[],
): DuplicateCandidate<T>[] {
  const out: DuplicateCandidate<T>[] = [];

  for (const tx of existing) {
    // 1. Mismo archivo (aviso fuerte), sin importar monto/fecha.
    if (input.contentHash && tx.attachmentContentHash && tx.attachmentContentHash === input.contentHash) {
      out.push({ tx, reason: 'same-file' });
      continue;
    }
    // 2. Mismo monto+moneda dentro de la ventana de fecha (aviso suave), con refuerzos.
    const amountDate =
      sameAmount(tx.amount, input.amount) &&
      tx.currency === input.currency &&
      daysApart(tx.occurred_on, input.occurredOn) <= SIMILAR_DATE_WINDOW_DAYS;
    if (!amountDate) continue;

    const sameAccount = !!input.accountId && !!tx.account_id && input.accountId === tx.account_id;
    const inDesc = normalizeDescription(input.description);
    const sameDesc = inDesc !== '' && inDesc === normalizeDescription(tx.description);
    out.push({
      tx,
      reason: sameAccount ? 'amount-date-account' : sameDesc ? 'amount-date-desc' : 'amount-date',
    });
  }

  const reasonRank = (r: DuplicateReason) => (r === 'same-file' ? 0 : 1);
  return out.sort((a, b) => {
    const byReason = reasonRank(a.reason) - reasonRank(b.reason);
    if (byReason !== 0) return byReason;
    return daysApart(a.tx.occurred_on, input.occurredOn) - daysApart(b.tx.occurred_on, input.occurredOn);
  });
}
