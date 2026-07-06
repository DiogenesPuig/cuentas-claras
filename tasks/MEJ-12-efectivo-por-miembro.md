# MEJ-12 Efectivo por defecto: un medio "Efectivo" por miembro (con dueño)

**Sprint:** Mejoras · **Modelo sugerido:** Sonnet (implementar; diseño ya cerrado) · **Depende de:** —

> **Etapa 1 de la identidad/efectivo (decisión 2026-07-07).** Cubre el caso de miembros existentes,
> sin tocar el modelo de identidad. El caso "efectivo/gasto de un NO-miembro" es la Etapa 2 =
> `tasks/MEJ-4-alias-titulares.md` (Parte B, persona sin cuenta / placeholder).

## Objetivo
Que cada miembro del workspace tenga automáticamente un medio **"Efectivo"** propio (con
`owner_member_id` = ese miembro), para no tener que crearlo a mano y para que los gastos en efectivo
queden atribuidos a su dueño (la persona se deduce del medio, como el resto).

## Decisiones cerradas (2026-07-07)
- **Uno por persona, con dueño** (no un efectivo genérico por workspace).
- Se crea automáticamente para cada miembro.

## Pasos (a afinar al implementar)
1. **Seed del efectivo por miembro.** Opciones a evaluar (elegir la más simple y portable):
   - Trigger en DB al insertar en `workspace_members` (crea el `accounts` type='cash', owner=ese
     miembro, name="Efectivo"). Aplica también al alta del primer miembro (onboarding) y a los que
     aceptan invitación.
   - o crearlo desde `api.ts` en el flujo de alta de miembro/onboarding (menos "mágico", más portable).
   - Contemplar miembros **ya existentes** (backfill: seed para los que no tienen efectivo todavía).
2. Verificar que no se dupliquen (un solo "Efectivo" por miembro).
3. Que el medio aparezca en el combo del alta y en la lista de Medios como cualquier otro (type='cash',
   sin banco/red/last4 → `accountLabel` cae al `name` "Efectivo (+ dueño)").
4. `typecheck` / `lint` / `test`. Si hay migración/trigger: aplicar en local + remoto y regenerar tipos.

## Criterios de aceptación
- [ ] Al crear un workspace / al unirse un miembro, existe un medio "Efectivo" con ese miembro de dueño.
- [ ] Los miembros existentes también quedan con su "Efectivo" (backfill).
- [ ] Un gasto en efectivo queda atribuido a la persona dueña del medio (sin elegir persona a mano).
- [ ] No se crean efectivos duplicados.
- [ ] Si trae migración/trigger: aplicada en remoto + tipos regenerados + `schema_fase1.sql` al día.

## Fuera de alcance
- Persona del grupo **sin cuenta** y su efectivo → Etapa 2 (MEJ-4 Parte B).
- Selector de persona en el alta → Etapa 2.

## Por qué este modelo
Sonnet: seed acotado (trigger o api) con diseño ya cerrado; el riesgo (efectivo por miembro) es bajo.
