# BUG-16 Entrar por link de invitación como usuario nuevo cae en "crear grupo"

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Un usuario **sin cuenta y sin sesión** que abre un link de invitación (`/invite/:token`) debe, tras
registrarse/loguearse, terminar en la **pantalla de aceptar la invitación** (y unirse a ESE grupo),
no en el onboarding de "crear un grupo".

## Contexto (causa encontrada)
- Reportado por el usuario (2026-07-09). **No tiene que ver con el ban de HF** (las invitaciones no
  usan el micro de ingesta).
- Flujo: `/invite/:token` está detrás de `RequireAuth` (`src/app/router.tsx`). Sin sesión →
  redirige a `/login` con `state.from = /invite/:token`. `LoginPage`/`RegisterPage` **sí** preservan
  ese `from` entre ellas y hacen `navigate(from ?? '/')` al terminar → por **email/password** debería
  volver a `/invite/:token`. (Verificar que ande, puede haber un race de sesión.)
- **Causa fuerte — signup con Google:** `signInWithGoogle` (`src/features/auth/api.ts`) usa
  `options: { redirectTo: window.location.origin }`. El OAuth hace un redirect de página completa a
  la **raíz** (`/`), y el `location.state` (el `from` con el token) **se pierde** en ese round-trip.
  Al volver, el usuario nuevo queda en `/` → `RequireWorkspace` ve 0 grupos → **`/onboarding`**. La
  invitación se pierde.
- Relacionado pero distinto: BUG-2 (aceptar invitación sin grupo previo) era del lado DB (migración
  0013). Esto es routing/OAuth del front.

## Pasos
1. **Google/OAuth:** propagar el destino de la invitación a través del OAuth. Opciones:
   - `redirectTo` dinámico que incluya el token (ej. `window.location.origin + /invite/<token>`), o
   - guardar el token pendiente en `localStorage`/`sessionStorage` antes de disparar el OAuth y
     consumirlo al volver (redirigir a `/invite/<token>` si hay uno pendiente).
2. **Email/password:** verificar que el `from` llega bien tras el signup (confirm email está OFF, así
   que hay sesión inmediata); si hay un race con la propagación de sesión, esperar/re-evaluar.
3. Test del flujo: usuario nuevo (sin grupos) + invitación → termina en aceptar/unirse, no en onboarding.

## Criterios de aceptación
- [ ] Usuario nuevo que se registra por **email** desde una invitación termina uniéndose a ese grupo.
- [ ] Usuario nuevo que se registra por **Google** desde una invitación termina uniéndose a ese grupo
      (no en onboarding).
- [ ] El caso sin invitación (registro normal) sigue yendo al onboarding.

## Por qué este modelo
Sonnet: fix de routing/OAuth acotado, con verificación de los dos caminos de alta.
