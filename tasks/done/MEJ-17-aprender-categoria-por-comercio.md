# MEJ-17 Aprender/recordar la categoría por persona o comercio recurrente

**Sprint:** Mejoras · **Modelo sugerido:** Opus (cerrar modelo de datos/UX) → Sonnet (implementar) · **Depende de:** —

## Objetivo
Que la app **tienda a poner la misma categoría** para un mismo comercio/persona recurrente. Ejemplo
del usuario: el **alquiler** se lo transfiere a la misma persona todos los meses → debería sugerir
(o autocompletar) la misma categoría sin tener que elegirla cada vez.

## Contexto
- Pedido del usuario (2026-07-10), en el marco de IDENT-1 (persona en el movimiento).
- Hoy la sugerencia de categoría es por **keywords de comercio** (`src/lib/category-suggest.ts`,
  F2-6, FR-19): reglas fijas (uber→Transporte, etc.), no aprende de lo que hace el usuario.

## A decidir (diseño)
- **Clave de la asociación:** ¿por **descripción/comercio** normalizado?, ¿por **persona**
  (`owner_member_id`, IDENT-1) —ej. "a Juan siempre es Alquiler"—?, ¿o ambas?
- **Fuente:** ¿se **aprende de la historia** (la categoría más usada para esa clave en movimientos
  pasados, sin tabla nueva) o se **guarda explícito** (tabla `category_hints (workspace, key, category)`)?
  Aprender de la historia es más simple (sin migración) y "se autoentrena"; una tabla es más
  predecible pero requiere UX para gestionarla.
- **Cómo se aplica:** ¿solo **sugerir** (como F2-6, con botón "Usar", nunca pisa)?, ¿o **autocompletar**
  la categoría (editable)? Recomendado: sugerir, consistente con lo actual.
- **Alcance:** a nivel workspace (lo comparte el grupo).

## Pasos (post-diseño)
1. Definir la clave + fuente (historia vs tabla).
2. Lógica pura en `lib/` (ej. `learnedCategory(key, history)` o extender `category-suggest`), con tests.
3. Cablearla en el alta (`TransactionForm`): la sugerencia aprendida tiene prioridad sobre la de
   keywords; sigue siendo editable.

## Criterios de aceptación
- [ ] Al cargar un movimiento de un comercio/persona ya categorizado antes, se sugiere esa categoría.
- [ ] Nunca pisa una categoría elegida por el usuario; siempre editable.
- [ ] Lógica pura con tests.

## Fuera de alcance
- Re-categorizar movimientos viejos.
- IA/embeddings (sigue siendo por reglas/frecuencia).
