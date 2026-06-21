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
- `TransactionsPage.tsx` — pantalla `/movimientos`: alta/edición/borrado de movimientos (B8) +
  lista con búsqueda (`SearchBar`, debounced) y filtros combinables (`FilterBar`: persona, medio,
  categoría, moneda) más el mes activo, todo aplicado en la query vía `useTransactions` (B10).
- `DashboardPage.tsx` — pantalla `/` (inicio): resumen del mes activo (`SummaryCard`), últimos
  movimientos (`RecentTransactions`) y alta rápida vía `Fab` + modal con `TransactionForm` (B9).
  El filtro de mes se aplica en la query (`useTransactions(workspaceId, { month })`, B10), no en
  el cliente.
- `ReportsPage.tsx` — pantalla `/reportes`: desglose por dimensión (`ReportTabs` + `DonutChart`),
  totales consolidados (`ConsolidatedTotals`) y comparativa mes a mes (`BarChart`) (C13). Trae los
  movimientos de una ventana de 6 meses en una sola query y agrega/consolida todo en el cliente
  con `features/reports` (sin lógica de datos propia).

## Carpetas

- `layout/` — shell de la app autenticada (`AppLayout`, `Header`, `TabBar`).
