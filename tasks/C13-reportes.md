# C13 Reportes (tabs + gráficos)

**Sprint:** C · **Modelo sugerido:** Sonnet · **Depende de:** B10, C11, C12

## Objetivo
Pantalla de reportes con desgloses por categoría, persona, banco, red y medio, más comparativa mes a mes, con consolidado multi-moneda.

## Contexto
- `PRD.md` §5.6 (FR-22, FR-24).
- `wireframes/wireframes_fase1.html` pantalla 6 (tabs: Categoría/Persona/Banco/Red/Medio).
- `PLAN_TECNICO_FASE1.md` §8 (consolidación con `money.consolidate`).

## Archivos a crear/editar
- `src/features/reports/` → `api.ts` (agregaciones), `hooks.ts`, `components/ReportTabs`, `components/DonutChart`, `components/BarChart`.
- `src/app/` → `ReportsPage` (ruta `/reportes`).

## Pasos
1. Agregaciones por dimensión (categoría/persona/banco/red/medio). Persona = holder del medio; "por persona" lista extensiones y su titular.
2. Torta (Recharts) para la dimensión elegida; barras para mes a mes.
3. Aplicar consolidación multi-moneda (C11) con la cotización del workspace (C12).
4. Respetar el período activo.

## Criterios de aceptación
- [ ] Las 5 dimensiones de desglose funcionan y suman el total.
- [ ] "Por persona" agrupa por holder e incluye extensiones bajo su titular.
- [ ] Totales por moneda + consolidado en base.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Export (ticket C14).

## Tests
- Test de las funciones de agregación (agrupar/sumar por dimensión), con mock de movimientos.

## Por qué este modelo
Sonnet: agregaciones + gráficos; la parte delicada (consolidación) ya está testeada en C11.
