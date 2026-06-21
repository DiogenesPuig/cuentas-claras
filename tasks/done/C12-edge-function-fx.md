# C12 Edge function de FX + tabla `fx_rates` + cron (keep-alive)

**Sprint:** C · **Modelo sugerido:** Sonnet · **Depende de:** A2

## Objetivo
Cachear diariamente las cotizaciones (dolarapi/BCRA) en una tabla `fx_rates` mediante una edge function programada, que además mantiene activo el proyecto Supabase.

## Contexto
- `PRD.md` §9.4 (fuentes: dolarapi principal, BCRA oficial), §15 (pausa por inactividad / keep-alive).
- `PLAN_TECNICO_FASE1.md` §8.
- Fuentes: dolarapi.com (`/v1/...`), BCRA Estadísticas Cambiarias.

## Archivos a crear/editar
- `supabase/migrations/0003_fx_rates.sql` → tabla `fx_rates (id, date, source, quote, currency, rate, created_at)` con índice/único por (date, source, quote, currency). RLS de solo lectura para miembros autenticados; escritura solo desde la función (service role).
- `supabase/functions/fx-refresh/index.ts` → fetch a la fuente, upsert en `fx_rates`.
- Configurar **schedule** (cron diario) de la función.

## Pasos
1. Crear la migración de `fx_rates` (+ regenerar `database.types.ts`).
2. Edge function: consultar dolarapi (oficial/blue/MEP) y guardar; BCRA como referencia oficial.
3. Upsert idempotente por día/fuente/cotización/moneda.
4. Programar el cron diario (Supabase scheduled functions).
5. Documentar el contrato (qué cotizaciones se guardan y con qué `quote`).

## Criterios de aceptación
- [ ] La función corre y deja filas del día en `fx_rates`.
- [ ] Es idempotente (re-correr el mismo día no duplica).
- [ ] El cron queda configurado (corrida diaria) → sirve de keep-alive.
- [ ] El front puede leer la cotización elegida por el workspace (`fx_source`/`fx_quote`).
- [ ] `typecheck`/`lint` ok (en la función).

## Fuera de alcance
- El cálculo de consolidación (ticket C11) — acá solo se proveen los datos.

## Tests
- Test de la función de parseo de la respuesta de la API (mock del payload).

## Por qué este modelo
Sonnet: integración con API externa + migración + cron; trabajo acotado. Si la fuente cambia de forma o hay que elegir entre varias cotizaciones por defecto, **escalar a Opus**.
