# MEJ-16 Separar "Transporte" (viajes) de "Auto" (nafta/mantenimiento)

**Sprint:** Mejoras · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Diferenciar los gastos de **transporte** (uber/taxi/colectivo/subte/avión) de los del **auto**
(nafta, service, cubiertas, patente, seguro, peajes…), que hoy caen todos en una sola categoría.

## Contexto (causa)
- Pedido del usuario (2026-07-09).
- Hoy hay una sola categoría default **"Transporte"** (🚗) en el seed
  (`supabase/migrations/0001_init.sql` ~L390) y `src/lib/category-suggest.ts` (regla `Transporte`)
  **mezcla** ambos mundos en sus keywords: `uber, cabify, didi, taxi, remis, sube, subte, peaje,
  aerolineas, latam, flybondi, despegar…` **junto con** `ypf, shell, axion, puma energy, estacion de
  servicio`.

## Decisión a tomar (chica)
- Nombres/emoji de las dos categorías, ej. **"Transporte"** 🚌 (viajes/públicos/apps) y **"Auto"** 🚙
  (o "Vehículo"). Confirmar con el usuario.

## Pasos
1. **Seed:** agregar la categoría nueva (ej. "Auto") a las default. Nota: el seed aplica a workspaces
   **nuevos**; para los existentes, o se agrega a mano, o una migración de backfill inserta la
   categoría faltante en los workspaces que ya tienen las default (decidir alcance).
2. **`category-suggest.ts`:** separar las keywords en dos reglas:
   - **Transporte:** uber, cabify, didi, beat, taxi, remis, sube, subte, colectivo, peaje, aerolineas,
     latam, flybondi, jetsmart, despegar…
   - **Auto:** ypf, shell, axion, puma energy, estacion de servicio, nafta, combustible, gnc,
     lubricentro, gomeria, cubiertas, taller, mecanico, service, patente, seguro (auto)…
   Ajustar tests de `category-suggest.test.ts` (que gas station → Auto, uber → Transporte).
3. Si hay migración/seed: aplicar en local + remoto.

## Criterios de aceptación
- [ ] Existen dos categorías: transporte (viajes) y auto (vehículo).
- [ ] La sugerencia manda nafta/estaciones a "Auto" y uber/taxi/colectivo a "Transporte".
- [ ] Tests de `category-suggest` actualizados y verdes.
- [ ] Si trae seed/migración para workspaces existentes: aplicada en remoto.

## Fuera de alcance
- Re-categorizar movimientos viejos ya cargados como "Transporte" (quedan como están; el usuario los
  edita si quiere).

## Por qué este modelo
Sonnet: cambio de seed + reglas de keyword puras con tests; decisión de nombres es chica.
