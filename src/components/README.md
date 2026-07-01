# src/components

UI reutilizable y transversal.

## Carpetas

- `ui/` — componentes de shadcn/ui (copiados con `npx shadcn@latest add <comp>`).
  No se editan a mano salvo necesidad; quedan fuera del lint (ver `eslint.config.js`).

## Archivos

- `WorkspaceSwitcher.tsx` — selector del workspace activo + botón "Nuevo grupo" (abre `CreateWorkspaceDialog`); usa `useActiveWorkspace`.
- `MonthSwitcher.tsx` — navegación del período/mes activo (usa `useActiveMonth`).
- `WelcomeGreeting.tsx` / `WelcomeGreeting.test.tsx` — saludo "¡Hola, &lt;nombre&gt;!" (MEJ-3): usa el
  nombre del perfil (`useMyProfile`) y cae a la parte local del email; no renderiza si no hay ninguno.
  Se muestra en el `Header` y en `GroupsLanding`.
