# src/app

Composición de la aplicación: rutas, providers y layout.

## Archivos

- `router.tsx` — rutas (`/login`, `/register`, `/onboarding`, `/` protegida con `RequireAuth` +
  `RequireWorkspace`).
- `providers.tsx` — `QueryClientProvider` + `AuthProvider`.
- `OnboardingPage.tsx` — pantalla `/onboarding`: pide nombre del usuario, nombre del grupo y
  moneda base; crea el primer workspace (A4).
- `OnboardingPage.test.tsx` — smoke test de validación del form de onboarding.

## Contenido previsto

- `layout/` — `AppLayout`, `Header`, `TabBar`. [A5]
