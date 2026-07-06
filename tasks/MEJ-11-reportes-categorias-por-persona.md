# MEJ-11 Reportes: desglose de categorías al ver por persona

**Sprint:** Mejoras · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
En `/reportes`, cuando se ve el gráfico/desglose **por persona**, poder ver **explícitamente en qué
categorías** gastó cada persona (no solo el total ni la categoría dominante).

## Contexto
- Pedido del usuario (2026-07-06).
- Hoy `PersonaBreakdown` (`src/features/reports/components/PersonaBreakdown.tsx`) muestra el total por
  persona y, como mucho, una pista de la categoría dominante ("mayormente en Super / varios"). No
  hay un desglose por categoría dentro de cada persona.

## Pasos / opciones
1. Agregar un **drill-down**: al expandir una persona, mostrar su desglose por categoría (montos y/o
   mini-donut).
2. La agregación pura probablemente vive/va en `src/features/reports/aggregate.ts` (persona × categoría);
   mantener la lógica pura y testeada, el componente declarativo.
3. Decidir UX: acordeón expandible por persona, o una vista secundaria.

## Criterios de aceptación
- [ ] Al ver por persona, se puede ver el desglose por categoría de esa persona (montos por categoría).
- [ ] La lógica de agregación es pura y con tests.

## Fuera de alcance
- Rediseño general de reportes.

## Por qué este modelo
Sonnet: agregación pura + un componente de desglose, con tests; sin decisiones de datos nuevas.
