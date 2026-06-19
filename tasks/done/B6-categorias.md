# B6 Categorías (seed global + CRUD propias)

**Sprint:** B · **Modelo sugerido:** Haiku · **Depende de:** A5

## Objetivo
Listar categorías (globales + del workspace) y permitir crear/editar/archivar categorías propias.

## Contexto
- `db/schema_fase1.sql` → `categories` (`workspace_id` NULL = global; `kind` expense|income). RLS ya permite leer globales y escribir las propias (owner/admin).
- `PRD.md` FR-18.

## Archivos a crear/editar
- `src/features/categories/` → `api.ts`, `hooks.ts`, `schema.ts`, `components/CategoryList`, `components/CategoryForm`.

## Pasos
1. `listCategories(workspaceId)` → globales (`workspace_id is null`) + propias.
2. `createCategory` / `updateCategory` (name, kind, icon, color).
3. UI simple de gestión (lista separada por gasto/ingreso + form).
4. Hook `useCategories(kind?)` para reutilizar en el alta de movimientos.

## Criterios de aceptación
- [ ] Se ven las categorías globales sembradas + las del workspace.
- [ ] Owner/admin puede crear y editar categorías propias; un member no.
- [ ] `useCategories` filtra por `kind` cuando se pide.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Sugerencia automática de categoría (fase 2).

## Tests
- Smoke test del form (name requerido, kind válido).

## Por qué este modelo
Haiku: CRUD mecánico siguiendo el patrón api+hooks ya establecido, sin decisiones de diseño. Si el patrón aún no está rodado, Sonnet.
