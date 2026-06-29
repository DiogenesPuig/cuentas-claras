/**
 * Capa de presentación pura de los apodos (MEJ-8). No conoce Supabase ni React.
 * `AliasMap` mapea la `personaKey` de los reportes (`member:<id>` o `name:<norm>`) al
 * apodo privado del usuario. `displayPersonaLabel` devuelve el apodo si existe (no vacío),
 * y si no, el label real. Mantener acá la regla evita duplicarla por cada lista/donut.
 */

export type AliasMap = Record<string, string>;

export function displayPersonaLabel(key: string, baseLabel: string, aliases: AliasMap): string {
  const alias = aliases[key]?.trim();
  return alias ? alias : baseLabel;
}
