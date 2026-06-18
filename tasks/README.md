# Backlog — Fase 1 (MVP)

Un archivo por ticket. Cada uno es **autocontenido**: un subagente debería poder ejecutarlo leyendo solo ese archivo + los documentos que enlaza (`PRD.md`, `db/schema_fase1.sql`, `PLAN_TECNICO_FASE1.md`, `CLAUDE.md`).

## Cómo usar este backlog

1. Elegí el ticket de menor número cuyas **dependencias** estén completas.
2. Pasale a un subagente **un solo ticket** (no todo el backlog), para no inflar el contexto/costo.
3. Al terminar: `typecheck`, `lint`, `test`, y revisión contra los criterios de aceptación.
4. Marcá el ticket como hecho (mové el archivo a `tasks/done/` o tildá el encabezado).

## Orden y dependencias

**Sprint A — Cimientos**
- `A1` Scaffolding del proyecto — _sin dependencias_
- `A2` Migraciones + generación de tipos — depende de A1
- `A3` Cliente Supabase + Auth — depende de A2
- `A4` Perfil + onboarding (primer workspace) — depende de A3
- `A5` Workspace activo + layout/navegación — depende de A4

**Sprint B — Núcleo de registro**
- `B6` Categorías (seed + CRUD) — depende de A5
- `B7` Medios/tarjetas (lista plana + form, con extensiones) — depende de A5
- `B8` Alta/edición de movimientos — depende de B6, B7
- `B9` Dashboard mensual — depende de B8
- `B10` Movimientos: lista + filtros + búsqueda — depende de B8

**Sprint C — Visualización y grupo**
- `C11` Lógica de dinero y ciclos (money + billing) + tests — depende de A1
- `C12` Edge function de FX + tabla `fx_rates` + cron/keep-alive — depende de A2
- `C13` Reportes (tabs + gráficos) — depende de B10, C11, C12
- `C14` Exportar CSV/XLSX — depende de B10
- `C15` Grupo: miembros, roles, invitaciones — depende de A5

C11 y C12 pueden empezar en paralelo a Sprint B (solo dependen de cimientos).

**Sprint D — Mantenimiento / Calidad**
- `D16` Saneamiento de dependencias (npm audit + ESLint EOL) — depende de A1. _No bloquea features (son avisos de tooling de dev); saldar en un cambio controlado._

## Plantilla de ticket

```
# [ID] Título

**Sprint:** _ · **Modelo sugerido:** _ · **Depende de:** _

## Objetivo
## Contexto (links a docs)
## Archivos a crear/editar
## Pasos
## Criterios de aceptación  (checklist)
## Fuera de alcance
## Tests
## Por qué este modelo
```

## Definition of Done

Ver `CLAUDE.md` → "Definición de hecho". Resumen: compila, lint ok, tests (si hay lógica pura), cumple criterios de aceptación, sin scope creep, sin dependencias nuevas no autorizadas.
