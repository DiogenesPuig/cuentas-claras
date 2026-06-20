# B9 Dashboard mensual

**Sprint:** B · **Modelo sugerido:** Sonnet · **Depende de:** B8

## Objetivo
Pantalla de inicio con resumen del mes (ingresos/gastos/balance, consolidado multi-moneda), últimos movimientos y botón "+".

## Contexto
- `PRD.md` §5.6 (FR-20, FR-21).
- `wireframes/wireframes_fase1.html` pantalla 2.
- `PLAN_TECNICO_FASE1.md` §6, §8 (consolidación).

## Archivos a crear/editar
- `src/features/transactions/components/` → `SummaryCard`, `RecentTransactions`.
- `src/components/` → `Fab`.
- `src/app/` → `DashboardPage` (ruta `/`).

## Pasos
1. Query de movimientos del período activo (usa `MonthSwitcher`).
2. `SummaryCard`: total ingresos, gastos, balance; desglose por moneda + consolidado en base (usa `money.consolidate` de C11 si está; si no, placeholder solo por moneda).
3. `RecentTransactions`: últimos N movimientos con persona (holder del medio), medio y fecha.
4. `Fab` abre el `TransactionForm` (modal).

## Criterios de aceptación
- [ ] El resumen refleja el período y workspace activos.
- [ ] Muestra totales por moneda; si C11 está integrado, también el consolidado en base.
- [ ] El "+" abre el alta y, al guardar, la lista y el resumen se actualizan.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Gráficos (ticket C13).

## Tests
- No aplica (UI). La lógica de consolidación se testea en C11.

## Por qué este modelo
Sonnet: composición de UI con datos; sin decisiones nuevas si C11 ya define la consolidación.
