// Edge function `fx-refresh` (C12) — corre en Deno, NO en el bundle del front.
// La invoca el cron diario (ver migración 0005_fx_refresh_cron.sql). Hace:
//   1. fetch a dolarapi (/v1/dolares)
//   2. parsea con la lógica pura de ./parse.ts
//   3. upsert idempotente en `fx_rates` (onConflict por date,source,quote,currency)
//
// Escribe con la service_role key (saltea RLS). `SUPABASE_URL` y
// `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma de Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseDolarApi } from './parse.ts';

const DOLARAPI_URL = 'https://dolarapi.com/v1/dolares';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  let payload: unknown;
  try {
    const res = await fetch(DOLARAPI_URL);
    if (!res.ok) return json({ error: `dolarapi respondió ${res.status}` }, 502);
    payload = await res.json();
  } catch (err) {
    return json({ error: `fetch a dolarapi falló: ${String(err)}` }, 502);
  }

  const rows = parseDolarApi(payload);
  if (rows.length === 0) return json({ error: 'dolarapi no devolvió cotizaciones usables' }, 502);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase
    .from('fx_rates')
    .upsert(rows, { onConflict: 'date,source,quote,currency' });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, upserted: rows.length });
});
