# Getting Started — Cuentas Claras

Guía para retomar el proyecto en otra máquina (PC de desarrollo) y trabajar el backlog con Claude Code de forma barata y ordenada.

## 1. Requisitos en la máquina (una sola vez)

- **Git**
- **Node.js** (LTS) + npm
- **Supabase CLI** (`supabase`) — para migraciones y generación de tipos
- **Claude Code** instalado
- Una **cuenta/proyecto en Supabase** (las claves van en `.env`, que genera el ticket A1)

## 2. Clonar y abrir Claude Code en la carpeta

```bash
git clone https://github.com/DiogenesPuig/cuentas-claras.git
cd cuentas-claras
claude            # abre Claude Code en la carpeta → lee CLAUDE.md automáticamente
```

> Claude Code lee `CLAUDE.md` solo: ahí está el contexto, el stack, las reglas de código, la política de modelos y el flujo de trabajo. No hace falta re-explicarle el proyecto.

## 3. Prompt de arranque (pegar en la primera interacción)

```
Leé CLAUDE.md y tasks/README.md. Vamos a trabajar el backlog de la Fase 1
en orden de dependencias, UN ticket por vez. Empezá por
tasks/A1-scaffolding.md: implementá solo ese ticket respetando sus
criterios de aceptación; al terminar corré typecheck/lint/test y mostrame
el diff antes de seguir.
```

## 4. Prompt para cada ticket siguiente (mismo molde)

```
Implementá tasks/<ID-del-ticket>.md. Solo ese ticket. Si aparece una
decisión no resuelta (dependencia nueva, cambio de esquema, ambigüedad
en los criterios), pará y consultame en vez de improvisar.
```

La última frase activa la **regla de escalado** descrita en `CLAUDE.md`.

## 5. Elegir el modelo según la tarea

Cada ticket trae un campo **"Modelo sugerido"**. En Claude Code se cambia con `/model`:

- **Sonnet** — implementador por defecto (la mayoría de los tickets).
- **Haiku** — tareas mecánicas (p. ej. B6 categorías, C14 export).
- **Opus** — vos lo usás para revisar diffs o resolver decisiones de diseño; no ejecuta tickets.

Para revisar un cambio podés usar el comando `/review`.

## 5.b Automatizar el cambio de modelo (runner)

Para no cambiar `/model` a mano en cada ticket, usá el runner headless:

```bash
chmod +x scripts/run-ticket.sh    # una sola vez
scripts/run-ticket.sh A1          # corre A1 con el modelo correcto, valida y commitea
scripts/run-ticket.sh A1 --dry-run   # ver qué haría, sin ejecutar
```

El runner elige el modelo por ticket (según `scripts/backlog.tsv`), corre `typecheck`/`lint`/`test` si existen y commitea solo si pasa. Detalle y flags (`--all`, `--yolo`, `--model`, `--no-commit`) en `scripts/README.md`. Para decisiones de diseño o revisar un diff, seguís usando Opus aparte cuando quieras.

## 6. Reglas para que salga barato y ordenado

- **Un ticket por conversación/sesión.** No le pases todo el backlog: solo el ticket que toca. Así el agente barato no arrastra contexto de más.
- **Respetar dependencias.** El orden y el grafo están en `tasks/README.md`.
- **Revisar antes de mergear.** Mirá el diff vos (o con Opus) contra los criterios de aceptación del ticket.
- **No agregar dependencias** fuera de las del stack sin escalar la decisión.
- **Mantener los índices de carpeta.** Al crear/borrar archivos, actualizar el `README.md` de esa carpeta (ver convención en `CLAUDE.md`).

## 7. Orden de trabajo (resumen)

`A1 → A2 → A3 → A4 → A5` (cimientos) → `B6, B7 → B8 → B9, B10` (núcleo) → `C11, C12 → C13, C14, C15` (visualización y grupo). `C11` y `C12` pueden adelantarse en paralelo al Sprint B.

Detalle y criterios de salida: `tasks/README.md` y `PLAN_TECNICO_FASE1.md` §12.
