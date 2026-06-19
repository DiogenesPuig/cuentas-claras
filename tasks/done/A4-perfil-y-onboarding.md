# A4 Perfil + onboarding (primer workspace)

**Sprint:** A · **Modelo sugerido:** Sonnet · **Depende de:** A3

## Objetivo
Asegurar que cada usuario tenga su fila en `profiles` y, si no pertenece a ningún workspace, guiarlo a crear el primero.

## Contexto
- `db/schema_fase1.sql` → `profiles`, `workspaces` (trigger `trg_ws_add_owner` agrega al creador como owner).
- `PRD.md` §3 (uso individual = workspace de 1 miembro), §13 (onboarding).
- `PLAN_TECNICO_FASE1.md` §7.

## Archivos a crear/editar
- `src/features/workspaces/` → `api.ts` (createWorkspace, listMyWorkspaces), `hooks.ts`.
- `src/features/auth/` → al primer login, crear `profiles` si falta (nombre del proveedor).
- `src/app/` → `OnboardingPage` (crear primer grupo: nombre + moneda base).

## Pasos
1. Tras autenticar, verificar/crear la fila en `profiles` (id = auth.uid()).
2. Query "mis workspaces" (vía `workspace_members`).
3. Si no tiene ninguno → `OnboardingPage`: formulario con `name` y `base_currency` (default ARS) → `createWorkspace`.
4. Al crear, el trigger agrega al usuario como owner; refrescar y entrar al dashboard.

## Criterios de aceptación
- [ ] Un usuario nuevo termina con un `profile` y, tras el onboarding, un workspace donde es owner.
- [ ] Un usuario con workspaces salta el onboarding.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Selector de workspace y layout (ticket A5).
- Invitar miembros (ticket C15).

## Tests
- Smoke test del form de creación de workspace (validación de nombre/moneda).

## Por qué este modelo
Sonnet: lógica de datos directa apoyada en triggers ya definidos; no introduce decisiones de diseño.
