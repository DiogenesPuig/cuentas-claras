# BUG-15 Editar un medio abre el form al pie de toda la lista

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Editar un medio en **Medios** debe abrir el form **pegado a la tarjeta** que tocaste, no al final de
toda la lista (hoy, si editás el medio de más arriba, tenés que bajar hasta el final).

## Contexto (causa)
- Reportado por el usuario (2026-07-07), en la misma línea que BUG-12 pero es OTRA pantalla:
  la lista de **Medios** (`AccountList`), no la de movimientos.
- `AccountList` renderiza el form de alta/edición **después** del `<ul>` de tarjetas → el form
  aparece al pie. Con las tarjetas del rediseño (MEJ-4A), editar la de arriba obliga a scrollear.
- Preferencia del usuario: **inline, pegado a la tarjeta** (no modal, a diferencia de BUG-12 que sí
  es modal porque es una lista larga de filas).

## Cambio
- `AccountRow` acepta `editForm?: ReactNode`: si se está editando ESE medio, el form se renderiza
  **dentro de la tarjeta** (sub-sección con separador), y se oculta el botón "Editar" de esa fila.
- El **alta** de un medio nuevo sigue al pie (el botón "+ Nuevo medio" está ahí).

## Criterios de aceptación
- [ ] Al tocar "Editar" en un medio, el form aparece dentro de esa tarjeta, sin scrollear.
- [ ] El alta (+ Nuevo medio) sigue funcionando (al pie).
- [ ] La sección de alias (medios transfer) no se pisa con el form de edición.

## Fuera de alcance
- La edición de movimientos (eso es BUG-12, con modal).

## Por qué este modelo
Sonnet: cambio de presentación acotado en `AccountList`, sin lógica nueva.
