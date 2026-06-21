# src/app/layout

Estructura visual común de la app autenticada.

## Archivos

- `AppLayout.tsx` — shell con `Header` + contenido (`<Outlet/>`) + `TabBar`. Asegura que el workspace activo sea válido (default al primero).
- `Header.tsx` — `WorkspaceSwitcher` + `MonthSwitcher` + cerrar sesión.
- `TabBar.tsx` — navegación principal: barra inferior (mobile) / sidebar (desktop). Tabs: Inicio/Categorías/Medios/Movimientos/Reportes/Grupo.
