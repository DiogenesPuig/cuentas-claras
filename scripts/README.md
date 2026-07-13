# scripts/ — Automatización del backlog

Runner para ejecutar los tickets de la Fase 1 con Claude Code en **modo headless**, eligiendo el modelo correcto por ticket (sin cambiar `/model` a mano).

## Contenido

- `run-ticket.sh` — corre un ticket (o todo el backlog) con `claude -p`, valida `typecheck`/`lint`/`test` si existen y commitea por ticket. Para si algo falla.
- `backlog.tsv` — orden del backlog: `id`, `model`, `depends`, `file`, `subject`. Es la fuente del modelo por ticket.
- `ident1-collapse.harness.test.ts` — **migración de datos de un solo uso** (IDENT-1 paso 5): colapsa los medios transfer/cash por-persona a los compartidos y pone la persona en el movimiento. No es un test (se ejecuta vía vitest solo para resolver los imports de `@/lib`; en CI, sin la env `IDENT1`, queda **skipped**). Reusa el planificador puro `lib/ident1-collapse`. **Por defecto NO escribe** (dry-run); escribe solo con `IDENT1_APPLY=1`. Uso: `IDENT1=1 SB_URL=<url> SB_KEY=<service_role> IDENT1_OUT=/ruta/plan.txt npx vitest run scripts/ident1-collapse.harness.test.ts` (agregar `IDENT1_APPLY=1` para aplicar). Idempotente. **Hacer backup antes de aplicar en remoto.**
- `logs/` — salida de cada corrida (`<fecha>-<id>.log`). Ignorado por git.

## Requisitos

- **Claude Code** instalado (`claude` en el PATH; o setear `CLAUDE_BIN`).
- Estar dentro del repo (el script encuentra la raíz solo).
- La primera vez, dar permiso de ejecución: `chmod +x scripts/run-ticket.sh` (o invocarlo con `bash scripts/run-ticket.sh ...`).

## Uso

```bash
scripts/run-ticket.sh A1            # corre el ticket A1 (modelo según backlog) y commitea
scripts/run-ticket.sh A1 --dry-run  # muestra qué haría, sin ejecutar
scripts/run-ticket.sh B6            # B6 corre en Haiku (mecánico); el resto en Sonnet
scripts/run-ticket.sh A3 --model opus   # forzar un modelo para esta corrida
scripts/run-ticket.sh A1 --no-commit    # implementa y valida, sin commit
scripts/run-ticket.sh --all         # corre TODO el backlog en orden (desatendido); para ante el 1er fallo
scripts/run-ticket.sh A1 --yolo     # salta permisos (autonomía total; ver nota)
```

## Flujo recomendado (barato y con control)

1. Corré **un ticket** por vez en orden de dependencias (ver `tasks/README.md`).
2. Revisá el diff del commit que dejó el script (vos o con Opus) antes de seguir.
3. Para tramos mecánicos (B6, C14) podés encadenar con `--all` si ya tenés confianza.

## Permisos (importante)

Muchos tickets corren comandos (`npm`, `supabase`). Con el default (`--permission-mode acceptEdits`) Claude puede pedir confirmación para esos comandos. Para correr 100% desatendido usá `--yolo` (equivale a `--dangerously-skip-permissions`). Usalo **solo en este repo**, nunca en algo sensible. También podés ajustar los flags con la variable `CLAUDE_PERM`.

## Cómo cambiar el modelo de un ticket

Editá la columna `model` en `backlog.tsv` (`sonnet`, `haiku`, `opus`). Es coherente con el campo "Modelo sugerido" de cada ticket en `tasks/`.
