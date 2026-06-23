/**
 * Match de la tarjeta de un resumen (`account_hint` del micro) contra los medios
 * (`accounts`) del workspace, para asociar los movimientos importados al medio
 * correcto o, si no existe, ofrecer crearlo (FR-16b). Lógica PURA y testeable: no
 * conoce Supabase ni el tipo `Account` de la DB (opera sobre una forma mínima), así
 * el criterio de match vive en un solo lugar portable.
 *
 * Criterio (de más a menos fuerte):
 * 1. **`last4` + red compatible**: la señal más confiable. Un único medio con ese
 *    `last4` → match directo. Varios (ej. titular y extensión con distinto last4 no
 *    aplica; mismo last4 sí) → se desambigua por titular.
 * 2. **Titular + banco** (cuando el resumen no trae `last4`, ej. Nativa-Nación): un
 *    único medio cuyo titular comparte nombre/apellido y banco compatible → match.
 * 3. Coincidencias parciales → `candidates` para que el usuario elija; nada → crear.
 */

import { nameTokenOverlap, normalizeName } from './name-match';

export interface AccountHint {
  bank: string | null;
  network: string | null;
  last4: string | null;
  holder: string | null;
}

/** Forma mínima de un medio necesaria para el match (subconjunto de `accounts`). */
export interface MatchableAccount {
  id: string;
  bank: string | null;
  network: string | null;
  last4: string | null;
  holderName: string | null;
  isExtension?: boolean;
}

export interface AccountMatchResult<T> {
  /** Único medio que matchea con confianza → se asocia directo. */
  matched: T | null;
  /** Varios posibles o match parcial → el usuario elige (o crea uno nuevo). */
  candidates: T[];
}

/** Cuántos tokens de nombre comparten dos titulares (apellido/nombre), sin importar el orden. */
const holderOverlap = nameTokenOverlap;

/** Compatibles si coinciden o si falta el dato de algún lado (no descarta por ausencia). */
function networkCompatible(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  return normalizeName(a) === normalizeName(b);
}

function bankCompatible(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Ambos bancos conocidos y NO compatibles → conflicto (ej. Nación vs Patagonia). */
function bankConflicts(a: string | null, b: string | null): boolean {
  if (!a || !b) return false; // dato faltante ≠ conflicto
  return !bankCompatible(a, b);
}

/** Banco compatible y conocido en AMBOS lados (no por ausencia). */
function bankPositivelyCompatible(a: string | null, b: string | null): boolean {
  return !!a && !!b && bankCompatible(a, b);
}

export function matchAccount<T extends MatchableAccount>(
  hint: AccountHint,
  accounts: readonly T[],
): AccountMatchResult<T> {
  // 1. Match fuerte por last4 (+ red compatible, sin conflicto de banco).
  if (hint.last4) {
    const byLast4 = accounts.filter(
      (a) =>
        a.last4 != null &&
        a.last4 === hint.last4 &&
        networkCompatible(a.network, hint.network) &&
        !bankConflicts(a.bank, hint.bank),
    );
    if (byLast4.length === 1) return { matched: byLast4[0], candidates: [] };
    if (byLast4.length > 1) {
      // Mismo last4 en varios medios → desambiguar por titular.
      const byHolder = byLast4.filter((a) => holderOverlap(a.holderName, hint.holder) >= 2);
      if (byHolder.length === 1) return { matched: byHolder[0], candidates: [] };
      return { matched: null, candidates: byLast4 };
    }
    // last4 no encontrado → no hay match fuerte; seguimos por titular abajo.
  }

  // 2. Por titular + banco (caso sin last4 en el resumen, ej. Nativa-Nación).
  //    El auto-match exige que el banco coincida POSITIVAMENTE en ambos lados: así un
  //    resumen de Banco Nación nunca se asocia solo a una tarjeta de otro banco (ni a una
  //    sin banco) por mero parecido de nombre. Sin esa certeza, queda como candidato.
  if (hint.holder) {
    const strong = accounts.filter(
      (a) =>
        holderOverlap(a.holderName, hint.holder) >= 2 &&
        bankPositivelyCompatible(a.bank, hint.bank) &&
        networkCompatible(a.network, hint.network),
    );
    if (strong.length === 1) return { matched: strong[0], candidates: [] };
    if (strong.length > 1) return { matched: null, candidates: strong };

    // Candidatos débiles: comparten al menos un token de nombre y el banco NO entra en
    // conflicto (banco desconocido de algún lado → candidato, nunca auto-match cruzado).
    const weak = accounts.filter(
      (a) => holderOverlap(a.holderName, hint.holder) >= 1 && !bankConflicts(a.bank, hint.bank),
    );
    if (weak.length > 0) return { matched: null, candidates: weak };
  }

  return { matched: null, candidates: [] };
}

/**
 * Valores neutros para precargar el alta de un medio nuevo desde el `account_hint`.
 * No depende del schema del form (eso lo mapea la feature), para no atar `lib/` a la UI.
 */
export interface AccountDefaultsFromHint {
  name: string;
  bank: string;
  network: string;
  last4: string;
  holderName: string;
}

export function accountDefaultsFromHint(hint: AccountHint): AccountDefaultsFromHint {
  const name =
    [hint.bank, hint.network, hint.last4 ? `••${hint.last4}` : null].filter(Boolean).join(' ') ||
    'Tarjeta';
  return {
    name,
    bank: hint.bank ?? '',
    network: hint.network ?? '',
    last4: hint.last4 ?? '',
    holderName: hint.holder ?? '',
  };
}
