/**
 * Match del titular de un lado (origen/destino) de una transferencia (F2-9) contra
 * los miembros del workspace, para preasignar `owner_member_id` al crear el medio
 * `bank_account`. Lógica PURA y testeable: no conoce Supabase ni el `MemberOption`
 * de la feature `accounts` (opera sobre una forma mínima).
 *
 * Token-set: orden de nombre indistinto ("Pérez Juan" === "Juan Pérez"), exige
 * ≥2 tokens significativos en común; ante ambigüedad (varios miembros con el mismo
 * overlap) no preasigna a nadie — mejor que el usuario elija a mano.
 */

import { nameTokenOverlap, nameTokens } from './name-match';

/** Forma mínima de un miembro necesaria para el match. */
export interface MatchableMember {
  id: string;
  name: string;
}

export function matchMember<T extends MatchableMember>(
  holder: string | null | undefined,
  members: readonly T[],
): T | null {
  if (nameTokens(holder).length < 2) return null;
  const matches = members.filter((m) => nameTokenOverlap(holder, m.name) >= 2);
  return matches.length === 1 ? matches[0] : null;
}
