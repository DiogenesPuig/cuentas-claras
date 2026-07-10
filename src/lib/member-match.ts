/**
 * Match del titular de un lado (origen/destino) de una transferencia (F2-9) contra
 * los miembros del workspace, para preasignar `owner_member_id` al crear el medio
 * `bank_account`. Lógica PURA y testeable: no conoce Supabase ni el `MemberOption`
 * de la feature `accounts` (opera sobre una forma mínima).
 *
 * Token-set: orden de nombre indistinto ("Pérez Juan" === "Juan Pérez"), exige
 * ≥2 tokens significativos en común; ante ambigüedad (varios miembros con el mismo
 * overlap) no preasigna a nadie — mejor que el usuario elija a mano.
 *
 * IDENT-1 paso 4: además del nombre, se consideran los **alias** de la persona
 * (movidos desde `accounts.holder_aliases`). Un alias es una afirmación explícita
 * de identidad del usuario, así que un match EXACTO (clave orden/tildes-indistinta)
 * contra un alias es autoritativo aunque sea de una sola palabra (ej. "Pepito"),
 * donde el overlap de ≥2 tokens no alcanzaría.
 */

import { nameTokenOverlap, nameTokens, normalizeNameKey } from './name-match';

/** Forma mínima de un miembro necesaria para el match. */
export interface MatchableMember {
  id: string;
  name: string;
  /** Nombres alternativos de la persona (IDENT-1 paso 4): el match los considera además del principal. */
  aliases?: string[];
}

/** ¿El `holder` identifica a este miembro por su nombre o por alguno de sus alias? */
function memberMatches(
  member: MatchableMember,
  holder: string | null | undefined,
  hintKey: string,
): boolean {
  const hasTwoTokens = nameTokens(holder).length >= 2;
  // Nombre principal: overlap de ≥2 tokens (comportamiento histórico, sin alias).
  if (hasTwoTokens && nameTokenOverlap(holder, member.name) >= 2) return true;
  // Alias: overlap ≥2, o match exacto de clave (autoritativo aunque sea 1 palabra).
  for (const alias of member.aliases ?? []) {
    if (hasTwoTokens && nameTokenOverlap(holder, alias) >= 2) return true;
    if (hintKey && normalizeNameKey(alias) === hintKey) return true;
  }
  return false;
}

export function matchMember<T extends MatchableMember>(
  holder: string | null | undefined,
  members: readonly T[],
): T | null {
  const hintKey = normalizeNameKey(holder);
  const matches = members.filter((m) => memberMatches(m, holder, hintKey));
  return matches.length === 1 ? matches[0] : null;
}
