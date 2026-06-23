/**
 * Normalización de nombres de persona compartida por los matchers de `lib/`
 * (titular de medio ↔ resumen en `account-match.ts`, titular de transferencia
 * ↔ miembro en `member-match.ts`). Pura, sin dependencias.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens significativos del nombre (ignora iniciales tipo "D" para no inflar el overlap). */
export function nameTokens(value: string | null | undefined): string[] {
  return normalizeName(value)
    .split(' ')
    .filter((t) => t.length >= 3);
}

/** Cuántos tokens de nombre comparten dos personas (apellido/nombre), sin importar el orden. */
export function nameTokenOverlap(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const tokensA = new Set(nameTokens(a));
  return nameTokens(b).filter((t) => tokensA.has(t)).length;
}

/**
 * Clave de nombre insensible a tildes y al orden de las palabras ("Pérez Juan" y "Juan Perez"
 * dan la misma clave). Pensada para deduplicar personas que no tienen `owner_member_id`
 * (F2-10): mismo dueño, escrito distinto en cada banco.
 */
export function normalizeNameKey(value: string | null | undefined): string {
  return [...nameTokens(value)].sort().join(' ');
}
