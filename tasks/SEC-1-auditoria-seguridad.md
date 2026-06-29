# SEC-1 Auditoría de seguridad (filtración de datos / acceso directo a la DB)

**Sprint:** Mantenimiento / Calidad · **Modelo sugerido:** Opus (revisar/decidir) + reviewer (adversarial) · **Depende de:** — (transversal, correr periódicamente)

## Por qué (el modelo de amenaza de esta app)
Cuentas Claras es un front (Vite/React) que habla **directo** con Postgres vía la API autogenerada de
Supabase (PostgREST) usando la **`anon key`, que es PÚBLICA por diseño** (va en el bundle). Es decir:
**cualquiera puede tomar esa key y pegarle a la API REST de la DB** (`/rest/v1/<tabla>`) desde afuera
de la app. Lo ÚNICO que impide leer/escribir datos de otros es **RLS** (Row Level Security) en la DB.

> Conclusión central: en este stack, "seguridad" = **RLS correcta y completa** + **no filtrar nada por
> vistas/funciones que la saltean** + **nunca exponer la `service_role` key**. El front NO es la frontera
> de seguridad (se puede bypassear); la DB sí.

## Objetivo
Verificar —y dejar guardas automáticas para que no se rompa a futuro— que:
1. Ningún usuario pueda leer/escribir datos de un workspace al que no pertenece (aislamiento multi-tenant).
2. No haya datos privados expuestos (ej. `profiles.phone_number`) ni vistas/funciones que filtren.
3. La `service_role` key nunca esté en el front/bundle/repo.
4. No haya dependencias con vulnerabilidades conocidas sin atender.

## Checklist de auditoría (one-time + repetible)

### A. RLS / multi-tenant (lo más crítico)
- [ ] **Toda tabla en `public` tiene RLS habilitada** (`rowsecurity = true`) y **al menos una policy**.
      Una tabla con RLS off (o on sin policies y sin `force`) queda accesible vía PostgREST.
      *Cómo:* query a `pg_tables`/`pg_policies` (ver "Guarda automática" abajo).
- [ ] **Cada policy filtra por pertenencia** (`is_member(workspace_id)` / `auth.uid()`), no por nada que
      el cliente pueda falsear. Revisar SELECT/INSERT/UPDATE/DELETE por separado (un INSERT sin
      `with check` correcto deja inyectar filas en otro workspace).
- [ ] **`persona_aliases` (MEJ-8), `accounts`, `transactions`, `categories`, `attachments`,
      `workspace_members`, `invitations`, `workspaces`, `profiles`, `fx_rates`**: repasar una por una
      contra una matriz tabla × operación × quién-debería-poder.
- [ ] **Funciones `security definer`** (`is_member`, `has_role`, `accept_invitation`, triggers):
      confirmar `set search_path = public` y que no devuelvan datos cruzados.
- [ ] **Vistas que saltean RLS**: `member_directory` es `security_invoker = false` (corre como owner)
      con `where is_member(...)`. Verificar que el WHERE no se pueda eludir y que NO exponga columnas
      sensibles (hoy expone name/avatar/role, NO el phone). Buscar otras vistas iguales.
- [ ] **Storage** (`storage.objects`, bucket de comprobantes B8): policies que limiten cada archivo a
      miembros de su workspace (no público, no listable por otros).

### B. Secretos / llaves
- [ ] **`service_role` key**: no está en `.env*` versionados, ni en el código del front, ni en el bundle
      (`grep -ri "service_role" src/ dist/`), ni en variables de Vercel expuestas al cliente
      (solo `VITE_*` llega al browser → confirmar que NINGUNA `VITE_*` sea un secreto).
- [ ] **Edge functions** (`fx-refresh`): secretos por Vault/env del runtime, no hardcodeados.
- [ ] `.gitignore` cubre `.env`, `.env.localdb`, etc. (revisar historial: `git log -p` por si se filtró
      alguna vez una key → si pasó, **rotarla**).

### C. Dependencias / tooling
- [ ] `npm audit --audit-level=high` sin findings sin atender (documentar los aceptados).
- [ ] El micro de ingesta (`services/ingesta`, Python): `pip-audit`/equivalente.

### D. Varios
- [ ] OAuth `redirectTo` no permite open-redirect (hoy `window.location.origin`, ok — confirmar).
- [ ] `api.ts` nunca arma SQL crudo (usa PostgREST parametrizado) — confirma que sigue así.
- [ ] Errores no devuelven stack/datos sensibles al usuario.

## Guardas automáticas a dejar (para que no se rompa de nuevo)
1. **Test SQL "RLS en todas las tablas"**: un check (pgTAP o un `.sql` corrido contra la DB local en CI,
   o un test que consulte `pg_class`/`pg_policies`) que **falle** si alguna tabla de `public` tiene RLS
   deshabilitada o sin policies. Es la red de seguridad más barata y de mayor impacto.
2. **`npm audit` en CI**: job que corra `npm audit --audit-level=high` (informativo o bloqueante, a
   decidir) en `ci.yml`.
3. **Dependabot** (`.github/dependabot.yml`) para npm (y pip del micro) → PRs de bumps de seguridad.
4. (Opcional, repo) **CodeQL** si el repo lo permite (GH Advanced Security / repos públicos).
5. Usar el subagente **`reviewer`** (claude-setup) en PRs que toquen auth/RLS/migraciones, y la skill
   `/security-review` sobre el diff antes de mergear cambios de riesgo.

## Criterios de aceptación
- [ ] Matriz RLS (tabla × operación × quién) revisada y sin huecos; hallazgos corregidos vía migración.
- [ ] Confirmado que la `service_role` key no aparece en front/bundle/repo.
- [ ] Guarda automática de "RLS en todas las tablas" corriendo en CI (falla si alguien agrega una tabla
      sin RLS).
- [ ] `npm audit` integrado al flujo (CI o ritual documentado) + Dependabot activo.
- [ ] Hallazgos documentados; los que impliquen cambio de esquema, con migración aplicada en remoto.

## Cómo encararlo (sugerencia de ejecución)
1. **Auditar primero, arreglar después**: generar el informe (matriz RLS + scans) sin tocar nada.
2. Para cada hueco: migración mínima que corrige la policy (revisar con `reviewer`).
3. Agregar las guardas automáticas en un PR aparte (CI + test RLS + Dependabot).
4. Repetir el `npm audit`/scan de RLS de forma periódica (idealmente en CI, no manual).

## Fuera de alcance
- Pentest externo / DAST.
- Hardening de infra de Supabase/Vercel más allá de la config del proyecto.
