# A2 Migraciones de Supabase + generación de tipos

**Sprint:** A · **Modelo sugerido:** Sonnet · **Depende de:** A1

## Objetivo
Llevar `db/schema_fase1.sql` a migraciones versionadas de Supabase y generar `src/lib/database.types.ts`.

## Contexto
- `db/schema_fase1.sql` — esquema completo (enums, tablas, RLS, vista `member_directory`, trigger de owner, seed de categorías).
- `PLAN_TECNICO_FASE1.md` §3 (config Supabase y tipos).

## Archivos a crear/editar
- `supabase/migrations/0001_init.sql` (y, si conviene partir, `0002_*` etc.).
- `src/lib/supabase.ts` (cliente tipado — puede adelantarse acá o en A3).
- `src/lib/database.types.ts` (GENERADO).

## Pasos
1. `supabase init` (si no existe) y linkear el proyecto (`supabase link`).
2. Partir el schema en migración(es). Mantener el orden: extensiones → enums → funciones → tablas → índices → RLS → vista → trigger → seed.
3. `supabase db push` (o aplicar en un proyecto de desarrollo).
4. `supabase gen types typescript --linked > src/lib/database.types.ts`.
5. Verificar que aparezcan las tablas y enums esperados (incl. `accounts` con `network`, `is_extension`, `parent_account_id`, `holder_name`).

## Criterios de aceptación
- [ ] Las migraciones aplican sin error en un proyecto Supabase limpio.
- [ ] RLS queda habilitada en todas las tablas con datos.
- [ ] `database.types.ts` se genera e incluye todas las tablas/enums del esquema.
- [ ] El seed de categorías globales queda cargado.

## Fuera de alcance
- Tabla `fx_rates` (ticket C12).
- Lógica de aplicación.

## Tests
- No aplica. Verificación manual de que las migraciones aplican y los tipos se generan.

## Por qué este modelo
Sonnet: requiere cuidado con el orden de objetos y la fidelidad al esquema; bajo riesgo de decisiones de diseño porque el SQL ya está definido.
