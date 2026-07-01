import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda de seguridad (SEC-1): en este stack el front habla directo con Postgres vía la API
 * pública (anon key), así que **RLS es la única frontera**. Este test falla si alguna tabla del
 * esquema de referencia (`db/schema_fase1.sql`) no tiene RLS habilitada o no tiene ninguna policy
 * — el error típico al agregar una tabla nueva. `db/schema_fase1.sql` debe reflejar todo el
 * esquema (es parte de la Definition of Done), así que sirve como fuente para el chequeo estático
 * (sin necesitar una DB en CI).
 */
const schema = readFileSync(resolve(process.cwd(), 'db/schema_fase1.sql'), 'utf8');

/** Tablas `create table <name> (` del esquema público (no storage/auth, que no se crean acá). */
function publicTables(sql: string): string[] {
  const re = /create table\s+(?:if not exists\s+)?(\w+)\s*\(/gi;
  return [...sql.matchAll(re)].map((m) => m[1]);
}

const tables = publicTables(schema);

describe('RLS coverage (SEC-1): toda tabla pública tiene RLS + policies', () => {
  it('encontró todas las tablas públicas para auditar (sanity)', () => {
    // Sube este número cuando agregues una tabla (y reflejala en schema_fase1.sql).
    expect(tables.length).toBe(10);
  });

  it.each(tables)('la tabla "%s" tiene RLS habilitada', (table) => {
    const enabled = new RegExp(`alter table\\s+${table}\\s+enable row level security`, 'i').test(schema);
    expect(enabled, `Falta: alter table ${table} enable row level security;`).toBe(true);
  });

  it.each(tables)('la tabla "%s" tiene al menos una policy', (table) => {
    const hasPolicy = new RegExp(`create policy\\s+\\w+\\s+on\\s+${table}\\b`, 'i').test(schema);
    expect(hasPolicy, `La tabla ${table} no tiene ninguna create policy → accesible vía la API pública`).toBe(true);
  });
});
