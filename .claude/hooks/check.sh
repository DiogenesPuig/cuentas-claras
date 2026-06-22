#!/usr/bin/env bash
#
# check.sh — Gate determinístico de typecheck/lint para Cuentas Claras.
#
# Pensado para el hook "Stop" de Claude Code: cuando el agente intenta terminar,
# corre typecheck y lint; si algo está en rojo, devuelve exit 2 y el error vuelve
# al agente para que lo corrija (no "termina" en rojo).
#
# - No falla si todavía no hay package.json (tickets previos al scaffolding A1).
# - Solo corre los scripts que existan (typecheck / lint).
# - Guard anti-loop: si el hook ya está activo (stop_hook_active), sale 0.
#
# También se puede correr a mano: `bash claude-setup/hooks/check.sh`

set -uo pipefail

# Evitar loop infinito en el hook Stop (ver docs de hooks de Claude Code).
input="$(cat 2>/dev/null || true)"
if printf '%s' "$input" | grep -q '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

# Ubicarse en la raíz del proyecto.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}" || exit 0

# Si todavía no hay proyecto JS, no hay nada que chequear: no bloquear.
[ -f package.json ] || exit 0

has_script() { node -e "process.exit((require('./package.json').scripts||{})['$1']?0:1)" 2>/dev/null; }

fail=0
for s in typecheck lint; do
  if has_script "$s"; then
    echo "▶ npm run $s" >&2
    npm run "$s" --silent 1>&2 || fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "GATE: typecheck/lint en ROJO. Corregí los errores de arriba antes de dar por terminado el ticket." >&2
  exit 2
fi

exit 0
