# C11 Lógica de dinero y ciclos (money + billing) + tests

**Sprint:** C · **Modelo sugerido:** Sonnet (tests obligatorios) · **Depende de:** A1

## Objetivo
Funciones puras y testeadas para la consolidación multi-moneda y para el cálculo del período según el día de cierre de cada tarjeta.

## Contexto
- `PRD.md` §5.6 (FR-9b consolidado), §9.4 (FX a fecha de cobro), FR-6b (ciclo configurable).
- `PLAN_TECNICO_FASE1.md` §8 (`money.ts`, `billing.ts`).

## Archivos a crear/editar
- `src/lib/money.ts` → `consolidate(txs, base, rates)`.
- `src/lib/billing.ts` → cálculo de rango de período y a qué ciclo cae un `charged_on` dado `billing_close_day`.
- `src/lib/money.test.ts`, `src/lib/billing.test.ts`.

## Pasos
1. `consolidate`: suma por moneda y total en base = monto si ya es base, o monto × rate. Devuelve `{ income, expense, balance, byCurrency }`.
2. `billing`: dado un `billing_close_day` y una fecha, devolver el período (inicio/fin) al que pertenece; manejar fin de mes (ej. cierre día 31 en febrero) y meses de distinta longitud.
3. Tests con casos límite: sin rate disponible (deja la moneda aparte), múltiples monedas, día de cierre 1 y 31, cambio de año.

## Criterios de aceptación
- [ ] `consolidate` cubre: solo base, base+otra, varias otras, rate faltante.
- [ ] `billing` cubre: cierre a mitad de mes, día 31 en meses cortos, borde de fin de año.
- [ ] Todos los tests pasan; funciones puras (sin side-effects, sin red).
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Obtener las cotizaciones (ticket C12). Acá `rates` se recibe como parámetro.

## Tests
- **Obligatorios** (es el objetivo del ticket). Vitest.

## Por qué este modelo
Sonnet con tests obligatorios: hay varios casos límite (fechas de cierre, fin de mes) donde un error es sutil; los tests son la red de seguridad. Si aparece una regla ambigua (p. ej. cómo tratar el rate faltante en el total), **escalar a Opus** antes de decidir.
