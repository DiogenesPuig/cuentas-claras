# BUG-2 No se puede aceptar una invitación sin tener un grupo previo

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Un usuario **sin ningún workspace** debe poder abrir un link de invitación (`/invite/:token`),
aceptarlo y quedar como miembro del grupo invitante. Hoy, si no tenés un grupo antes, **no te deja**
unirte por invitación.

## Contexto (links a docs)
- Reportado por el usuario con la app ya en producción (Vercel), 2026-06-27.
- Es el caso central del **link de invitación genérico** (recién agregado): quien recibe el link
  normalmente es alguien nuevo, sin grupos.
- Rutas: `src/app/router.tsx` — `/invite/:token` está envuelta **solo** en `RequireAuth`
  (no en `RequireWorkspace`), así que en teoría debería ser accesible sin grupo.
- A revisar (diagnóstico preliminar, no confirmado):
  - `RequireWorkspace` (`src/features/workspaces/components/RequireWorkspace.tsx`) redirige a
    `/onboarding` cuando no hay workspaces; verificar que el flujo de login/registro al abrir el
    link **no** mande a `/onboarding` antes de llegar a `/invite/:token` (el `from` ya se conserva
    tras el fix de auth, revisar que apunte al invite y no a `/`).
  - `OnboardingPage` redirige a `/` si ya hay workspaces, pero un usuario sin grupo que cae en
    onboarding pierde el token de invitación.
  - `InviteAcceptPage` (`src/app/InviteAcceptPage.tsx`) + `acceptInvitation`: confirmar que el alta
    funciona para un usuario con 0 grupos (no debería depender de tener uno).

## Pasos
1. Reproducir: usuario nuevo (0 grupos) abre `/invite/:token` → ver dónde se corta (¿redirige a onboarding? ¿error en accept?).
2. Corregir el flujo para que un usuario autenticado sin workspaces pueda aceptar y unirse.
3. Verificar también el camino "abrir link sin sesión → registro → vuelve al invite" (ya cubierto en parte por el fix de `from`).
4. `typecheck` / `lint` / `test`.

## Criterios de aceptación
- [ ] Usuario logueado con **0 grupos** abre el link → ve el preview → Aceptar → queda como miembro y entra al grupo.
- [ ] Usuario **sin sesión** abre el link → se registra/inicia sesión → **vuelve** al invite y se une (no cae en onboarding propio).
- [ ] El usuario que ya tiene grupos sigue pudiendo aceptar invitaciones como hasta ahora.

## Fuera de alcance
- Rediseño del onboarding.

## Tests
- Si el flujo se cubre con guards/redirects, agregar/ajustar tests de routing equivalentes a `InviteAcceptPage.test.tsx`.

## Por qué este modelo
Sonnet: bug de flujo/guards acotado, requiere reproducir y ajustar redirects.
