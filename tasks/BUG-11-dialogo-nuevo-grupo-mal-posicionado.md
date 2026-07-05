# BUG-11 El modal "Nuevo grupo" se posiciona mal cuando se abre desde el Header

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
El modal de crear grupo (`CreateWorkspaceDialog`) debe cubrir todo el viewport (overlay
centrado / bottom-sheet en mobile) **desde cualquier pantalla**, no solo desde la vista de grupos.

## Contexto
- Reportado por el usuario probando en local (2026-07-05): al tocar el botón **"+" (nuevo grupo)**
  del `WorkspaceSwitcher` en el Header —es decir, desde cualquier pestaña que **no** sea la vista
  de grupos— el modal aparece **pegado muy arriba de la pantalla y recortado**, no centrado.
- **Causa raíz:** `CreateWorkspaceDialog` usa `className="fixed inset-0 …"` para el overlay
  (`src/features/workspaces/components/CreateWorkspaceDialog.tsx:56`). Se renderiza dentro del
  `WorkspaceSwitcher` (`src/components/WorkspaceSwitcher.tsx:55`), que vive en el `<header>`.
  El header tiene **`backdrop-blur`** (`src/app/layout/Header.tsx:24`). Un ancestro con
  `backdrop-filter` (como `transform`/`filter`) **crea un containing block para los descendientes
  `position: fixed`**, así que el `inset-0` del diálogo se resuelve **contra el header** (barra
  finita arriba) en vez de contra el viewport → el modal queda arriba y recortado.
- **Por qué desde `/` (grupos) sí anda:** ahí el mismo `CreateWorkspaceDialog` lo monta
  `GroupsLanding` dentro del `<main>` (sin ancestro con blur/transform), y el `fixed inset-0`
  toma el viewport completo.

## Pasos
1. Renderizar el overlay de `CreateWorkspaceDialog` con un **portal a `document.body`**
   (`createPortal` de `react-dom`), para que escape del containing block del header y el
   `fixed inset-0` se mida siempre contra el viewport. Es el fix robusto e independiente de qué
   ancestro tenga blur/transform.
2. Verificar que sigue funcionando desde los dos puntos de entrada: el "+" del `WorkspaceSwitcher`
   (Header, todas las pestañas) y el botón "Nuevo grupo" de `GroupsLanding` (no debe regresionar).
3. `typecheck` / `lint` / `test`.

## Alternativas descartadas
- Quitar `backdrop-blur` del header: cambia el diseño y es frágil (cualquier otro `fixed`
  descendiente del header volvería a romperse).
- Subir el estado del diálogo a `AppLayout` (fuera del header): más plomería y no generaliza tan
  bien como el portal.

## Criterios de aceptación
- [ ] Abrir "+" nuevo grupo desde cualquier pestaña (Movimientos, Reportes, etc.) muestra el modal
      centrado/cubriendo el viewport, igual que desde la vista de grupos.
- [ ] El alta de grupo desde `GroupsLanding` sigue andando igual.

## Fuera de alcance
- Otros modales de la app (si aparecieran con el mismo patrón, se tratan aparte; este ticket es el
  de "Nuevo grupo").

## Por qué este modelo
Sonnet: fix de posicionamiento acotado (portal) en un componente existente, con verificación manual
en los dos puntos de entrada.
