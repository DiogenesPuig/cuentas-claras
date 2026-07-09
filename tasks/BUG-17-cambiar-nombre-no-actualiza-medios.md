# BUG-17 Cambiar mi nombre no se refleja en Medios → persona duplicada

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet (fix chico) o absorber en el rediseño de persona · **Depende de:** —

## Objetivo
Cambiar el nombre del perfil (`profiles.name`) debe reflejarse donde se muestra/filtra la persona
de un medio, sin generar "personas duplicadas" (nombre viejo vs nuevo).

## Contexto (causa)
- Reportado por el usuario (2026-07-09).
- El medio guarda `holder_name` **denormalizado** (snapshot del nombre al crearlo) además de
  `owner_member_id`. Al cambiar el nombre del perfil, `holder_name` queda viejo.
- **Reportes** ya usan el nombre vivo (agrupan por `owner_member_id` → `memberNameById`, F2-10), así
  que ahí anda. Pero **`AccountList` (lista de Medios)** y **`FilterBar` (filtro "Persona")** usan
  `holder_name` crudo → medios viejos muestran el nombre viejo y los nuevos el nuevo = persona
  duplicada al filtrar por persona en Medios. (Ya había un `TODO` en `AccountList` anticipándolo.)

## Opciones
- **(a) Absorber en el rediseño "persona en el movimiento" (MEJ-4B):** ahí la persona pasa a ser el
  miembro vivo en todos lados → este bug desaparece. Recomendado si el rediseño se hace pronto.
- **(b) Fix chico de display ahora (independiente):**
  - `AccountList`: cuando `owner_member_id` está seteado, mostrar el nombre vivo (`useMembersForHolder`
    / member_directory) en vez de `holder_name`.
  - `FilterBar` "Persona": agrupar/filtrar por `owner_member_id` (no por `holder_name`), como hacen
    los reportes, para que no aparezca la persona duplicada. (Cambia la semántica del filtro; algo
    más de trabajo que el de la lista.)

## Criterios de aceptación
- [ ] Tras cambiar el nombre del perfil, la lista de Medios y el filtro "Persona" muestran el nombre
      nuevo para los medios ligados a ese miembro, sin duplicar la persona.
- [ ] Los medios de titulares SIN miembro (`holder_name` sin `owner_member_id`) siguen mostrándose por
      su nombre.

## Relación
- Mismo root que el rediseño de **MEJ-4B** ("persona en el movimiento"): la denormalización del
  `holder_name`. Decidir si se hace el fix chico (b) ya o se espera al rediseño (a).
