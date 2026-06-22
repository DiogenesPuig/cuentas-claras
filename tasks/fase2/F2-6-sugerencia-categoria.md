# F2-6 Sugerencia automática de categoría

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-3, B6

## Objetivo
Sugerir automáticamente una categoría para cada movimiento (sobre todo al importar desde resumen) según su descripción/comercio, para que el usuario solo confirme. Arrancar con reglas/keywords; dejar la puerta abierta a algo más inteligente después.

## Contexto (links a docs)
- PRD §5.5 FR-19. `tasks/fase2/PLAN.md` §4.
- Categorías del workspace (B6): `categories` con `kind` (expense/income).

## DECISIÓN PENDIENTE
- **Motor de sugerencia.** Recomendado para empezar: **reglas por keyword** (mapa comercio/descr → categoría), puro y testeable, sin dependencias nuevas. IA/embeddings queda como mejora futura (escalar si se quiere, podría usar el microservicio Python).

## Archivos a crear/editar
- `src/lib/category-suggest.ts` (nuevo, puro y testeado): dada una descripción + categorías disponibles, devolver la sugerida (o ninguna) con un score.
- Integración en el alta de movimientos (B8) y en el staging de importación (F2-3): precargar la categoría sugerida, editable.
- Opcional: una tabla/seed de reglas por workspace (si se quiere que el usuario las edite) — evaluar alcance.

## Reglas iniciales sugeridas (del usuario, 2026-06-22)
Semilla de keyword → categoría (ampliar; case/acento-insensitive, match por substring del comercio):
- `uber`, `cabify`, `ypf`, `pedidosya*...` (si es viaje) → **Transporte**
- `carrefour`, `changomas`, `hiper`, `coto`, `dia` → **Supermercado**
- `pedidosya`, `mcdonalds`, `starbucks`, `cantina`, `la celeste` (gastronomía) → **Comida**
- `kiosco`, `pilusso` → **Compras** (o Kiosco)
- `farmacity`, `farmacia` → **Salud**
> Nota: algunos comercios son ambiguos (PedidosYa hace envíos de comida y de market). Resolver por
> prioridad/especificidad y dejar la sugerencia siempre editable.

## Pasos
1. Definir el set inicial de reglas (keywords → categoría) cubriendo comercios comunes AR (ver arriba).
2. `category-suggest.ts`: matching case/acentos-insensitive, prioridad por especificidad, devolver score.
3. Precargar la categoría sugerida en el form/staging, siempre editable por el usuario.
4. (Opcional) aprender de correcciones del usuario — fuera de alcance inicial, dejar nota.

## Criterios de aceptación
- [ ] Descripciones conocidas sugieren la categoría correcta; desconocidas no sugieren (no rompen).
- [ ] La sugerencia es siempre editable (nunca se aplica sin que el usuario pueda cambiarla).
- [ ] `lib/category-suggest.ts` testeado; `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- IA/embeddings (mejora futura). Edición de reglas por el usuario (evaluar como ticket aparte).

## Tests
- `category-suggest.test.ts`: keywords, insensibilidad a acentos/mayúsculas, empates por especificidad, sin match.

## Por qué este modelo
Sonnet: lógica pura por reglas, bien acotada, sin decisiones de arquitectura (la IA queda explícitamente fuera).
