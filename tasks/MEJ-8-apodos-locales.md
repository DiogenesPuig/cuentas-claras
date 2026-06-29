# MEJ-8 Apodos locales: renombrar a otras personas solo para mí

**Sprint:** Mejoras (post Fase 2) · **Modelo sugerido:** Sonnet (diseño cerrado con el usuario, 2026-06-29) · **Depende de:** C13 (reportes), F2-10 (identidad de persona)

## Problema (reportado por el usuario, 2026-06-29)
El usuario quiere poder ponerle **otro nombre** a personas del grupo (miembros o titulares ajenos)
**solo para él**: un apodo que vive en su dispositivo y NO cambia cómo los ven los demás.
(Distinto de MEJ-7, que cambia el nombre **propio** a nivel grupo.)

## Decisión de diseño (cerrada con el usuario, 2026-06-29)
- **Alcance: LOCAL (solo para mí).** Se guarda en el navegador (localStorage), por workspace. No
  toca la DB ni afecta a otros usuarios. Sin migración.
- **Qué se puede apodar:** cualquier "persona" de los reportes, identificada por su `personaKey`:
  - miembros → `member:<owner_member_id>` (estable);
  - no-miembros → `name:<holder normalizado>` (ver `lib/name-match.normalizeNameKey`).
  El apodo **pisa el label mostrado** donde aparece esa persona (donuts, listas, opciones de filtro).
- **No** afecta la agrupación/dedup (la identidad sigue siendo la misma `personaKey`); es puramente
  de presentación. Tampoco cambia el lumping de "Otros" (eso es MEJ-4 ampliado).

## Contexto / archivos
- Identidad de persona: `src/features/reports/aggregate.ts` (`personaIdentity` → `key`/`label`,
  privado; `dimensionLabelFor` expone el label). El apodo se aplica **sobre el label**.
- Pantalla: `src/app/ReportsPage.tsx` arma `memberNameById` y pasa labels a los componentes.
- Persistencia local: patrón Zustand `persist` (ya se usa para workspace/mes activos en
  `src/hooks/`), o un store nuevo `useLocalAliases` (clave por `workspaceId`).

## Decisión técnica a confirmar al implementar (Opus si hace falta)
Dónde aplicar el apodo manteniendo la lógica pura intacta. Opción recomendada: una **capa de
presentación** (ej. `displayPersonaLabel(key, baseLabel, aliases)`), aplicada en `ReportsPage` al
construir labels/opciones, sin meter localStorage en `aggregate.ts` (que debe seguir puro y testeado).
Para apodar no-miembros hace falta exponer la `personaKey` junto al label (hoy el filtro usa labels);
evaluar exponer `dimensionKeyFor`/`personaIdentity` o devolver `{key,label}` donde haga falta.

## Pasos
1. Store local de apodos por workspace (`Record<personaKey, alias>`) con `persist` en localStorage.
2. Capa pura de presentación `displayPersonaLabel(key, baseLabel, aliases)` (+ test): devuelve el
   apodo si existe, si no el label base.
3. UI para asignar/editar/quitar apodo de una persona (ej. en la lista por persona de reportes o en
   una gestión simple). Mínimo: un input por persona.
4. Aplicar el apodo en: donut/listas por persona y en las opciones de filtro de persona.
5. `typecheck` / `lint` / `test`. Actualizar READMEs si se crean archivos.

## Criterios de aceptación
- [ ] El usuario puede ponerle un apodo a una persona (miembro o no-miembro) y verlo reflejado en
      sus reportes, sin afectar a otros usuarios (vive en su dispositivo).
- [ ] Quitar el apodo vuelve al nombre original. El apodo persiste entre sesiones (localStorage).
- [ ] No cambia la agrupación ni el consolidado (es solo de presentación); `aggregate.ts` sigue puro.
- [ ] Sin migración; sin dependencias nuevas (Zustand ya está).

## Fuera de alcance
- Renombre propio global → MEJ-7.
- Destacar no-miembros / personas sin cuenta a nivel grupo → MEJ-4 (ampliado).
- Sincronizar apodos entre dispositivos del mismo usuario (queda local).
