# src/app/gates

Lógica de enrutamiento condicional: deciden a dónde navegar o qué pantalla genérica mostrar.
No tienen UI de dominio propia (a diferencia de `../pages/`).

## Archivos

- `HomeGate.tsx` — inicio `/`: 1 grupo → redirige a `/reportes`; >1 grupo → delega en
  `GroupsLanding` (`../pages/GroupsLanding.tsx`).
- `ErrorPage.tsx` — pantalla de error propia: cuadro centrado con título, descripción y link
  "Volver al inicio". Distingue 404 (ruta inexistente) de otros errores de routing vía
  `useRouteError`/`isRouteErrorResponse`. Usada como `errorElement` en la raíz del router y como
  ruta catch-all `*`.
