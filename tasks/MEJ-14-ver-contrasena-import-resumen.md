# MEJ-14 Botón para ver/ocultar la contraseña en el import de resumen

**Sprint:** Mejoras · **Modelo sugerido:** Sonnet (o Haiku) · **Depende de:** —

## Objetivo
Poder ver momentáneamente lo que se tipea en el campo **contraseña** del import de resumen
(`StatementImport`), para chequear que se puso bien (los PDF de resumen suelen venir con una
contraseña tipo DNI y es fácil equivocarse).

## Contexto
- Pedido del usuario (2026-07-09).
- El input está en `src/features/imports/components/StatementImport.tsx` (`type="password"`).

## Pasos
1. Agregar un botón (ícono ojo, `lucide-react` ya está) que alterne `type` entre `password` y `text`.
2. Estado local `showPassword`; accesible (aria-label "Mostrar/Ocultar contraseña").

## Criterios de aceptación
- [ ] Se puede alternar mostrar/ocultar la contraseña del import.
- [ ] Por defecto oculta.

## Por qué este modelo
Sonnet/Haiku: toggle de UI trivial en un componente existente.
