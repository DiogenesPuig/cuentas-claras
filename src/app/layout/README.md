# src/app/layout

Estructura visual común de la app autenticada.

## Archivos

- `AppLayout.tsx` — shell con `Header` + contenido (`<Outlet/>`) + `TabBar`. Asegura que el workspace activo sea válido (default al primero).
- `Header.tsx` — `WorkspaceSwitcher` + `MonthSwitcher` + cerrar sesión + botón "ver grupos" (solo si hay >1 grupo, vuelve a la landing).
- `TabBar.tsx` — navegación principal dentro de un grupo: barra inferior (mobile) / sidebar (desktop). Tabs: Reportes/Movimientos/Medios/Categorías/Grupo (la importación de resúmenes vive dentro de Movimientos).
