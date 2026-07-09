/**
 * Resolución de la "persona" de un movimiento (IDENT-1), compartida por reportes y por el filtro de
 * `/movimientos`. Orden: la persona del **movimiento** (`owner_member_id`) manda; si no, la del
 * **medio** (tarjeta de una persona); si no, el `holder_name` del medio (legacy); si no hay medio,
 * "Sin medio". Siempre se usa el nombre **vivo** del miembro (no el `holder_name` congelado) — eso
 * arregla BUG-17. Pura, sin red.
 */
import { normalizeNameKey } from './name-match';

/** Grupo/label de un movimiento sin medio asociado. */
export const NO_ACCOUNT_PERSONA = 'Sin medio';

/** Forma mínima de un movimiento para resolver su persona. */
export interface PersonaTransaction {
  owner_member_id: string | null;
  account: { owner_member_id: string | null; holder_name: string } | null;
}

/** Clave estable de agrupación de persona: `member:<id>` | `name:<normalizado>` | "Sin medio". */
export function personaKeyOf(tx: PersonaTransaction): string {
  if (tx.owner_member_id) return `member:${tx.owner_member_id}`;
  if (!tx.account) return NO_ACCOUNT_PERSONA;
  if (tx.account.owner_member_id) return `member:${tx.account.owner_member_id}`;
  return `name:${normalizeNameKey(tx.account.holder_name)}`;
}

/** Nombre legible de la persona (vivo del miembro cuando corresponde). */
export function personaLabelOf(
  tx: PersonaTransaction,
  memberNameById: ReadonlyMap<string, string>,
): string {
  if (tx.owner_member_id) {
    return memberNameById.get(tx.owner_member_id) ?? tx.account?.holder_name ?? 'Sin nombre';
  }
  if (!tx.account) return NO_ACCOUNT_PERSONA;
  if (tx.account.owner_member_id) {
    return memberNameById.get(tx.account.owner_member_id) ?? tx.account.holder_name;
  }
  return tx.account.holder_name;
}
