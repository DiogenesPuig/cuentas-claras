/**
 * Detección de titulares institucionales (BUG-5): organismos de recaudación,
 * empresas de servicios públicos, etc. Reutiliza los conjuntos de keywords de
 * `category-suggest` para mantenerse en sintonía con la categorización.
 *
 * "Institucional" significa: no es una persona, no corresponde crear un medio
 * `'transfer'` ni atribuirle un miembro; el nombre va a la descripción del gasto.
 */

import { IMPUESTOS_KEYWORDS, SERVICIOS_KEYWORDS } from './category-suggest';

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const INSTITUTIONAL_KEYWORDS = [...IMPUESTOS_KEYWORDS, ...SERVICIOS_KEYWORDS].map(norm);

/**
 * Devuelve `true` si `name` corresponde a un organismo, empresa de servicios o
 * entidad recaudadora (no a una persona física/miembro del workspace).
 * Usa match por substring, case/acento-insensitive. Principio: bajo riesgo de
 * falso positivo → si no matchea, el comportamiento actual no cambia.
 */
export function isInstitutionalPayee(name: string | null | undefined): boolean {
  const n = norm(name);
  if (!n) return false;
  return INSTITUTIONAL_KEYWORDS.some((kw) => n.includes(kw));
}
