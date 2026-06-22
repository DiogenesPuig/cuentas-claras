# src/app

Composición de la aplicación: rutas, providers y layout.

## Archivos

- `router.tsx` — rutas (`/login`, `/register`, `/onboarding`, `/invite/:token` protegida solo con
  `RequireAuth`, `/` protegida con `RequireAuth` + `RequireWorkspace` y envuelta en `AppLayout`,
  con hijas `categorias`/`medios`/`movimientos`/`importar`/`reportes`/`grupo`).
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
- `ImportPage.tsx` — pantalla `/importar`: subir un resumen de tarjeta (PDF), revisar los
  movimientos detectados y confirmarlos en bloque (`features/imports`, FR-16/F2-3).
- `ReportsPage.tsx` — pantalla `/reportes`: filtros combinables (`ReportFilterBar`), gasto por
  persona con % del total y categoría dominante (`PersonaBreakdown` + donut), desglose por dimensión
  (`ReportTabs` + `DonutChart`), totales consolidados (`ConsolidatedTotals`) y comparativa mes a mes
  (`BarChart`) (C13). Trae los movimientos de una ventana de 6 meses en una sola query y
  agrega/consolida/filtra todo en el cliente con `features/reports` (sin lógica de datos propia).
- `GroupPage.tsx` — pantalla `/grupo`: miembros (`MemberList`), invitar por email/link
  (`InviteSection`) y configuración del workspace activo (`WorkspaceSettings`) (C15).
- `InviteAcceptPage.tsx` — pantalla `/invite/:token`: muestra a qué grupo/rol invita el token
  (`useInvitationPreview`) y lo acepta (`useAcceptInvitation`); rechaza tokens vencidos/inválidos
  (C15). No requiere `RequireWorkspace`: quien acepta puede no tener workspaces todavía.
- `InviteAcceptPage.test.tsx` — valida los tres casos: token usable (muestra y acepta), vencido o
  revocado (sin botón de aceptar), y token inexistente.

## Carpetas

- `layout/` — shell de la app autenticada (`AppLayout`, `Header`, `TabBar`).
