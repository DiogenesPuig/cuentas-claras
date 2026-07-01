# BUG-8 findTransferAccount no cae a match fuzzy cuando el titular matchea a un miembro sin cuenta

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

> **Nota (chequeo 2026-07-02):** hacer **junto con BUG-7 y BUG-9 en una sola rama/PR** (mismo
> archivo/matcher/tests). Ver "Orden de resolución recomendado" en `tasks/README.md`. Quien haga
> MEJ-4 Parte A después debe leer este fix primero para unificar el matcher, no duplicarlo.

## Objetivo
Cuando el titular de una transferencia matchea a un miembro del workspace pero ese miembro
todavía no tiene un medio `'transfer'` con `owner_member_id` seteado (ej. se había creado antes
por nombre, cuando esa persona no era miembro todavía), **no** se debe crear un medio duplicado:
hay que reusar el existente.

## Contexto
- Detectado en revisión REF-1 (2026-07-01), leyendo `src/features/transactions/components/
  TransactionForm.tsx` `findTransferAccount` (líneas ~68-91).
- Cuando `matchedMemberId` es truthy, la función **solo** busca
  `transferAccounts.find(a => a.owner_member_id === matchedMemberId)` y devuelve `null` si no
  encuentra — nunca cae al matching fuzzy por `holder_name` para ese mismo titular.
- El comentario de la función (líneas 63-66) dice explícitamente "uno por persona, no por
  persona+banco", pero este caso lo rompe: el efecto de alta lazy (líneas ~211-216) termina
  creando un medio `'transfer'` nuevo para la misma persona.

## Pasos
1. En `findTransferAccount`, cuando hay `matchedMemberId` pero no aparece un medio con ese
   `owner_member_id`, caer al matching fuzzy por `holder_name`/alias (mismo criterio que el caso
   sin member match) antes de devolver `null`.
2. Si el fallback encuentra un medio, considerar si conviene además setear su `owner_member_id`
   (fuera de alcance si complica; puede quedar como follow-up — no perder de vista MEJ-4 Parte A,
   que toca el mismo matcher).
3. `typecheck` / `lint` / `test` (agregar caso: miembro matcheado + medio existente por nombre
   sin `owner_member_id` → reusa, no duplica).

## Criterios de aceptación
- [ ] Un titular que matchea a un miembro, con un medio `'transfer'` ya creado por nombre (sin
      `owner_member_id`), reusa ese medio en vez de crear uno nuevo.
- [ ] El caso ya cubierto (miembro con medio ya vinculado por `owner_member_id`) sigue igual.

## Fuera de alcance
- Migrar/unificar el `owner_member_id` de medios existentes (fuera de este fix puntual).
- El resto del matching de titulares (MEJ-4 Parte A lo trata en profundidad).

## Por qué este modelo
Sonnet: fix acotado en una función pura de matching, con tests.
