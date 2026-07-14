# MEJ-15 Eliminar un grupo (workspace)

**Sprint:** Mejoras · **Modelo sugerido:** Opus (cerrar diseño RLS/cascada) → Sonnet (implementar) · **Depende de:** —

## Objetivo
Poder **eliminar un grupo** (workspace) que ya no se usa.

## Contexto
- Pedido del usuario (2026-07-09). Hoy no hay forma de borrar un grupo.
- Es una acción **destructiva**: borra el grupo y todo lo colgado (miembros, medios, movimientos,
  categorías, invitaciones, apodos, comprobantes en Storage).

## Decisiones de diseño a cerrar (antes de implementar)
1. **Quién puede borrar:** solo el **owner** del grupo (RLS `delete` en `workspaces` para el owner).
2. **Cascada:** verificar que `workspaces` tenga `ON DELETE CASCADE` hacia `workspace_members`,
   `accounts`, `transactions`, `categories`, invitaciones, `persona_aliases`, etc. (revisar el
   esquema; varias ya lo tienen). **Comprobantes en Storage**: el `DELETE` de la DB no borra los
   archivos del bucket → decidir si se limpian (job/handler) o quedan huérfanos (aceptable v1).
3. **UX de confirmación:** al ser destructivo, pedir confirmación fuerte (ej. escribir el nombre del
   grupo para habilitar el botón), no un `confirm()` simple.
4. **Workspace activo tras borrar:** si se borra el grupo activo, reasignar el activo a otro grupo
   del usuario (o mandar a onboarding si no le queda ninguno). Reusar la lógica de
   `useEnsureActiveWorkspace` (`AppLayout`).
5. **RLS:** agregar política `delete` en `workspaces` (hoy probablemente no existe). No debilitar
   nada; solo el owner.

## Pasos (post-diseño)
1. Política RLS `delete` en `workspaces` (owner) + verificar cascadas (migración si falta alguna).
   Aplicar en local + remoto; regenerar tipos si cambia el esquema.
2. `api.ts` (`deleteWorkspace`) + hook (`useDeleteWorkspace`, invalida `myWorkspaces`).
3. UI en Grupo (`GroupPage`): sección "Zona de peligro" con confirmación por nombre.
4. Reasignar workspace activo tras borrar. Tests de la lógica pura que aplique.

## Criterios de aceptación
- [ ] Solo el owner puede borrar el grupo; un no-owner no (RLS).
- [ ] Confirmación fuerte (escribir el nombre) antes de borrar.
- [ ] Se borran en cascada miembros/medios/movimientos/categorías/invitaciones/apodos.
- [ ] Tras borrar el grupo activo, el usuario queda en otro grupo o en onboarding, sin pantallas rotas.
- [ ] Migración (RLS/cascada) aplicada en remoto + tipos al día si cambió el esquema.

## Fuera de alcance (v1)
- Limpieza de los comprobantes del bucket de Storage (posible follow-up).
- "Archivar" un grupo (soft-delete) en vez de borrarlo — evaluar aparte si se pide.

## Por qué este modelo
Opus para cerrar RLS/cascada/UX destructiva (riesgo alto: borra datos), Sonnet para implementar.
