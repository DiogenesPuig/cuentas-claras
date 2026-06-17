# A5 Workspace activo + layout y navegación

**Sprint:** A · **Modelo sugerido:** Sonnet · **Depende de:** A4

## Objetivo
Estado global del workspace activo y el layout de la app (header con selector de workspace y mes, navegación por tabs).

## Contexto
- `PLAN_TECNICO_FASE1.md` §6 (layout), §7 (workspace activo).
- `wireframes/wireframes_fase1.html` pantallas 2 (header + tabbar).

## Archivos a crear/editar
- `src/hooks/useActiveWorkspace.ts` (Zustand + persistencia en localStorage).
- `src/app/layout/` → `AppLayout`, `Header` (WorkspaceSwitcher + MonthSwitcher), `TabBar`.
- `src/app/router.tsx` → rutas privadas dentro de `AppLayout` con `<Outlet/>`.
- `src/components/` → `WorkspaceSwitcher`, `MonthSwitcher` (selección de mes/período).

## Pasos
1. Store `useActiveWorkspace` con `workspaceId` + `setWorkspace`, hidratado desde localStorage; default al primer workspace del usuario.
2. `AppLayout` con Header arriba, contenido (`<Outlet/>`) y `TabBar` abajo (Inicio/Movimientos/Reportes/Ajustes).
3. `WorkspaceSwitcher` lista los workspaces del usuario y cambia el activo.
4. `MonthSwitcher` mantiene el período seleccionado (estado en store o URL).
5. Responsive: en desktop, TabBar → sidebar.

## Criterios de aceptación
- [ ] El workspace activo persiste entre recargas.
- [ ] Cambiar de workspace refresca los datos dependientes (react-query keys incluyen `workspaceId`).
- [ ] La navegación por tabs funciona y resalta la activa.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Contenido real de cada pantalla (tickets B/C).

## Tests
- Test del store `useActiveWorkspace` (set/persistencia).

## Por qué este modelo
Sonnet: navegación y estado global estándar; el patrón ya está definido en el plan.
