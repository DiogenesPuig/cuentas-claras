# fx-refresh — cache de cotizaciones (C12)

Edge function que consulta dolarapi y guarda las cotizaciones del día en la tabla
`fx_rates`. La corre el cron diario (migración `0005_fx_refresh_cron.sql`), que
además sirve de keep-alive del proyecto (PRD §15). Implementa FR-9b / §9.4 a nivel
de datos (provee las cotizaciones; el consolidado lo hace `lib/money.ts`, C11).

## Archivos

- `index.ts` — entrypoint Deno: fetch a dolarapi → `parseDolarApi` → upsert en `fx_rates`.
- `parse.ts` — lógica PURA de parseo (sin Deno ni red), testeable con vitest.
- `parse.test.ts` — tests del parseo con payload mockeado.

## Contrato de datos

Fuente: `GET https://dolarapi.com/v1/dolares` (solo dolarapi en esta versión; BCRA
queda como follow-up).

Por cada cotización ofrecida por la app se escribe una fila en `fx_rates`:

| `source`   | `quote`   | `casa` en dolarapi | `currency` | `buy` / `sell`        |
|------------|-----------|--------------------|------------|-----------------------|
| `dolarapi` | `oficial` | `oficial`          | `USD`      | `compra` / `venta`    |
| `dolarapi` | `blue`    | `blue`             | `USD`      | `compra` / `venta`    |
| `dolarapi` | `mep`     | `bolsa`            | `USD`      | `compra` / `venta`    |

- `quote` espeja `workspaces.fx_quote`; el workspace elige cuál usa vía
  `fx_source` / `fx_quote`.
- Se guardan **compra y venta**; la elección de cuál usar al consolidar es del
  consumidor (front / C13).
- `date` es `fechaActualizacion` truncada a `YYYY-MM-DD`.
- Casas que la app no usa (`contadoconliqui`, `mayorista`, `cripto`, `tarjeta`, …)
  se ignoran.

## Idempotencia

`upsert` con `onConflict: date,source,quote,currency` contra el `unique` de la
tabla → re-correr el mismo día actualiza la fila, no duplica.

## Desplegar y programar

1. `supabase functions deploy fx-refresh`
2. Aplicar migraciones (`supabase db push`) → crea `fx_rates` y el cron.
3. Crear los dos secrets de Vault que usa el cron (ver cabecera de
   `0005_fx_refresh_cron.sql`): `project_url` y `service_role_key`.
4. Probar a mano: `supabase functions invoke fx-refresh` y verificar filas del día
   en `fx_rates`.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma; no se
setean a mano.

## Verificación post-deploy (importante)

El cron **falla en silencio** si los secrets de Vault faltan o están mal: la URL
queda nula y el POST no hace nada, sin error visible. Después de desplegar, y de
tanto en tanto, confirmá que realmente corre:

1. Última corrida del cron sin error:
   ```sql
   select status, return_message, start_time
   from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'fx-refresh-daily')
   order by start_time desc
   limit 5;
   ```
2. Hay filas del día en la tabla:
   ```sql
   select date, source, quote, currency, buy, sell
   from fx_rates
   where date = current_date;
   ```

Si (1) muestra fallos o (2) no devuelve filas, revisá que existan los dos secrets
de Vault (`project_url`, `service_role_key`) y que la función esté desplegada.
