# claude-setup/ — Reviewer + hook para Claude Code

Configuración propia (sin dependencias de terceros) que agrega dos cosas a Claude Code:

1. **Un subagente `reviewer`** — revisor adversarial independiente que verifica el diff de un ticket contra sus criterios de aceptación y los **archivos reales**, y caza trampas (RLS/multi-tenant, dinero/FX, permisos). No escribe código, solo informa. Corre en **Opus**.
2. **Un hook de gate** (`check.sh`) — al terminar un turno, corre `typecheck`/`lint`; si están en rojo, le devuelve el error al agente para que lo corrija (no "termina" en rojo). Es **determinístico** y no gasta tokens.

> Vive acá como plantilla porque la carpeta `.claude/` no se edita desde el editor. Se "instala" copiándola a `.claude/` con el script de abajo.

## Contenido

- `agents/reviewer.md` — definición del subagente revisor (frontmatter + instrucciones).
- `hooks/check.sh` — script del gate de typecheck/lint (skip si aún no hay `package.json`; guard anti-loop).
- `settings.json` — registra el hook `Stop` que llama a `check.sh`.
- `install.sh` — copia todo a `.claude/` del repo.

## Instalar (en tu PC de desarrollo)

```bash
bash claude-setup/install.sh
# reiniciá Claude Code para que tome los cambios
```

Esto crea `.claude/agents/reviewer.md`, `.claude/hooks/check.sh` y `.claude/settings.json`. Si ya tenías un `settings.json`, no lo pisa: te avisa para que fusiones el bloque `"hooks"` a mano.

## Usar el reviewer

Después de implementar un ticket de riesgo (auth, RLS, dinero, FX, permisos), pedíselo:

```
Usá el agente reviewer para revisar tasks/A3-supabase-y-auth.md contra el diff actual.
```

Te devuelve un veredicto (APROBADO / CAMBIOS REQUERIDOS) con hallazgos por severidad. Corrélo **solo en los tickets que valen** (gasta tokens de subagente); los mecánicos (B6, C14) no lo necesitan.

## Notas / tuning

- **Modelo del reviewer:** está fijado en `model: opus` en el frontmatter. Hay un bug conocido de Claude Code por el que el `model:` del frontmatter a veces se ignora y el subagente hereda el modelo del padre. Si querés forzarlo, corré la sesión principal en Opus para esa revisión, o seteá el modelo del subagente al invocarlo.
- **Hook en `Stop` vs `PostToolUse`:** elegí `Stop` (corre una vez al terminar el turno) para no ejecutar typecheck en cada micro-edición. Si preferís feedback inmediato tras cada edit, cambiá en `settings.json` el evento a `PostToolUse` con `"matcher": "Edit|Write|MultiEdit"`.
- **Guard anti-loop:** `check.sh` respeta `stop_hook_active` para no quedar en un loop de "no podés terminar".
