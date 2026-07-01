# src/app

Composición de la aplicación: rutas, providers y layout.

## Archivos

- `router.tsx` — rutas (`/login`, `/register`, `/onboarding`, `/invite/:token` protegida solo con
  `RequireAuth`; `/` = `HomeGate` (sin barra de secciones); las secciones
  `categorias`/`medios`/`movimientos`/`reportes`/`grupo` van bajo `AppLayout`. Todo
  protegido con `RequireAuth` + `RequireWorkspace`).
- `providers.tsx` — `QueryClientProvider` + `AuthProvider`.

## Carpetas

- `layout/` — shell de la app autenticada (`AppLayout`, `Header`, `TabBar`).
- `gates/` — lógica de enrutamiento condicional (decide a dónde navegar o qué pantalla genérica
  mostrar), sin UI de dominio propia: ver `gates/README.md`.
- `pages/` — pantallas de dominio, una por ruta (o delegada por un gate): ver `pages/README.md`.
