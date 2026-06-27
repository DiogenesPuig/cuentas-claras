# BUG-4 Página de error/404 propia (no la de React Router por defecto)

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Al entrar a una URL sin ruta asociada (o ante un error de routing), hoy se ve la pantalla
**por defecto de React Router** (fea, técnica). Reemplazarla por una propia: un **cuadro
centrado** con el mensaje correspondiente (ej. "Página no encontrada") y un link para volver.

## Contexto
- Router: `src/app/router.tsx` (`createBrowserRouter`). No hay `errorElement` ni una ruta
  catch-all (`path: '*'`), así que cae al fallback default de la librería.
- Hay patrones de "estado a pantalla completa centrado" para reusar el estilo, p. ej.
  `InviteAcceptPage` ("Invitación no disclonible") y `RequireWorkspace` (mensaje de error).

## Pasos
1. Crear `src/app/ErrorPage.tsx`: cuadro centrado (borde/sombra), título + mensaje + botón/link
   "Volver al inicio" (`/`). Que distinga 404 (ruta inexistente) de otros errores usando
   `useRouteError`/`isRouteErrorResponse` cuando se use como `errorElement`.
2. En `router.tsx`: agregar `errorElement: <ErrorPage />` (al menos en la raíz) **y** una ruta
   catch-all `{ path: '*', element: <ErrorPage /> }` para URLs sin match.
3. `typecheck`/`lint`/`test`.

## Criterios de aceptación
- [ ] Ir a una URL inexistente muestra el cuadro centrado propio con "Página no encontrada" + volver.
- [ ] Un error de carga de ruta muestra el mismo componente (mensaje genérico), no la pantalla default.
- [ ] El estilo es consistente con el resto (centrado, en español).

## Fuera de alcance
- Páginas de error específicas por código HTTP del backend.

## Por qué este modelo
Sonnet: componente de UI chico + config del router, sin lógica de negocio.
