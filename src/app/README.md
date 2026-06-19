# src/app

Composición de la aplicación: rutas, providers y layout.

## Archivos

- `router.tsx` — rutas (`/login`, `/register`, `/onboarding`, `/` protegida con `RequireAuth` +
  `RequireWorkspace` y envuelta en `AppLayout`, con hijas `movimientos`/`reportes`/`ajustes`).
- `providers.tsx` — `QueryClientProvider` + `AuthProvider`.
- `OnboardingPage.tsx` — pantalla `/onboarding`: pide nombre del usuario, nombre del grupo y
  moneda base; crea el primer workspace (A4).
- `OnboardingPage.test.tsx` — smoke test de validación del form de onboarding.

## Carpetas

- `layout/` — shell de la app autenticada (`AppLayout`, `Header`, `TabBar`).
