# src/app

Composición de la aplicación: rutas, providers y layout.

## Archivos

- `router.tsx` — rutas (`/login`, `/register`, `/onboarding`, `/` protegida con `RequireAuth` +
  `RequireWorkspace` y envuelta en `AppLayout`, con hijas `categorias`/`medios`/`movimientos`/`reportes`/`ajustes`).
- `providers.tsx` — `QueryClientProvider` + `AuthProvider`.
- `OnboardingPage.tsx` — pantalla `/onboarding`: pide nombre del usuario, nombre del grupo y
  moneda base; crea el primer workspace (A4).
- `OnboardingPage.test.tsx` — smoke test de validación del form de onboarding.
- `CategoriesPage.tsx` — pantalla `/categorias`: gestión de categorías del workspace activo (B6).
- `AccountsPage.tsx` — pantalla `/medios`: gestión de tarjetas/medios del workspace activo (B7).
- `TransactionsPage.tsx` — pantalla `/movimientos`: alta/edición rápida de movimientos (B8). Lista
  simple sin filtros (la lista con filtros/búsqueda es B10).
- `DashboardPage.tsx` — pantalla `/` (inicio): resumen del mes activo (`SummaryCard`), últimos
  movimientos (`RecentTransactions`) y alta rápida vía `Fab` + modal con `TransactionForm` (B9).
  Filtra los movimientos del workspace activo por el mes de `useActiveMonth` en el cliente (ver B10
  para el filtro por período en `listTransactions`).

## Carpetas

- `layout/` — shell de la app autenticada (`AppLayout`, `Header`, `TabBar`).
