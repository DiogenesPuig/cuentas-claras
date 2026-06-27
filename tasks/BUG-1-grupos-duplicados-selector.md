# BUG-1 Selector de grupo muestra el mismo workspace duplicado

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
En el selector de grupo (combo "qué grupo veo", `WorkspaceSwitcher`) cada grupo aparece **una sola vez**. Hoy se muestra **repetido una vez por cada miembro** que pertenece al grupo.

## Contexto (links a docs)
- Reportado por el usuario con la app ya en producción (Vercel), 2026-06-27.
- Causa raíz: `listMyWorkspaces` en `src/features/workspaces/api.ts` hace
  ```ts
  supabase.from('workspace_members').select('workspace:workspaces(*)').order('joined_at')
  ```
  **sin filtrar por el usuario actual**. La policy `wm_select` (`is_member(workspace_id)`)
  deja ver a **todos** los miembros de los grupos a los que pertenecés → la query devuelve
  una fila por miembro → el mismo `workspace` repetido N veces.
- Consumidores: `useMyWorkspaces` → `WorkspaceSwitcher` (`src/components/WorkspaceSwitcher.tsx`),
  `RequireWorkspace`, `OnboardingPage`.

## Archivos a crear/editar
- `src/features/workspaces/api.ts` → `listMyWorkspaces`: filtrar por el usuario autenticado
  (`.eq('user_id', user.id)` tras `supabase.auth.getUser()`), o de-duplicar por `workspace.id`.
  Preferible filtrar por `user_id` (más correcto y barato que de-duplicar en el cliente).

## Pasos
1. Ajustar `listMyWorkspaces` para traer solo las membresías del usuario actual.
2. Verificar que `WorkspaceSwitcher` muestra cada grupo una vez (grupo con 2+ miembros).
3. `typecheck` / `lint` / `test`.

## Criterios de aceptación
- [ ] Un grupo con varios miembros aparece **una sola vez** en el selector.
- [ ] Se siguen listando todos los grupos del usuario (no se pierde ninguno).
- [ ] Sin cambios de esquema ni de RLS (es un bug de query del front).

## Fuera de alcance
- Tocar la policy `wm_select` (sigue siendo correcta: ver miembros del grupo es necesario para `MemberList`).

## Tests
- Si se extrae lógica de de-dupe a `lib/`, testearla. Si se resuelve solo con `.eq('user_id', …)`, alcanza con verificación manual.

## Por qué este modelo
Sonnet: fix acotado de una sola query, causa ya diagnosticada.
