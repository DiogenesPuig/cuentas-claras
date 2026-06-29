# MEJ-7 Editar mi perfil: cambiar mi nombre (global)

**Sprint:** Mejoras (post Fase 2) · **Modelo sugerido:** Sonnet (diseño cerrado con el usuario, 2026-06-29) · **Depende de:** A4 (perfil/onboarding)

## Problema (reportado por el usuario, 2026-06-29)
El nombre del usuario se fija una sola vez en el onboarding (ej. quedó `diogepuig`) y no hay forma
de cambiarlo después. El usuario quiere poder **renombrarse** (ej. a `Dioge`).

## Decisión de diseño (cerrada con el usuario, 2026-06-29)
- **Alcance: GLOBAL (perfil).** Edita `profiles.name`: todo el grupo lo ve con el nuevo nombre (es
  su identidad real en la app, la que usan los reportes vía `member_directory`/nombre vivo del
  miembro F2-10). *No* es un apodo local (eso es MEJ-8, para renombrar a **otros** solo para uno).
- **Sin migración:** la tabla `profiles` y `upsertMyProfile` ya existen (onboarding A4). Solo falta UI.

## Contexto / archivos
- API: `src/features/auth/` o `src/features/profile/` — `upsertMyProfile` (ya usado por el onboarding).
  Verificar dónde vive (onboarding en `src/app/` o `src/features/auth/`).
- Auth/usuario actual: hook `useAuth` (sesión + user).
- Dónde colgar la UI: `src/app/layout/Header.tsx` (menú de usuario) o una página/sección de ajustes
  (`/perfil` o `/ajustes`). Definir al implementar (mínimo: un form con el nombre).
- El nombre vivo del miembro en reportes se resuelve por `owner_member_id` → `member_directory`
  (`useMembersForHolder`). Al cambiar el perfil hay que **invalidar** esas queries para que el
  cambio se refleje sin recargar (react-query `invalidateQueries`).

## Pasos
1. Sección/página de perfil con form (react-hook-form + zod) de un campo **Nombre** (reusar el
   schema del onboarding si aplica). Precargar el nombre actual.
2. Submit → `upsertMyProfile({ name })` (capa `api.ts`, sin tocar React desde ahí).
3. Hook react-query (`useUpdateMyProfile` o reuso del de onboarding) que, on success, **invalida**
   las queries de miembros/directorio y la del perfil propio, así el nombre nuevo aparece en
   reportes, header e invitaciones.
4. Enlace de acceso a la sección (menú de usuario en el Header).
5. `typecheck` / `lint` / `test`. Actualizar READMEs de carpeta si se crean archivos.

## Criterios de aceptación
- [ ] El usuario puede cambiar su nombre desde la app y el cambio persiste (`profiles.name`).
- [ ] El nombre nuevo se ve en reportes (nombre vivo del miembro), header e invitaciones sin recargar
      (queries invalidadas).
- [ ] Sin migración nueva; no se debilita RLS (un usuario solo edita su propio perfil).

## Fuera de alcance
- Renombrar a **otros** (apodos locales) → MEJ-8.
- Avatar/foto u otros campos de perfil (posible follow-up).
- "Personas sin cuenta" / destacar no-miembros → MEJ-4 (ampliado).
