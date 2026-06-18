#!/usr/bin/env bash
#
# install.sh — instala el reviewer y el hook en .claude/ de este repo.
# (La carpeta .claude/ no se versiona desde el editor, por eso vive acá como
#  plantilla y se "instala" con este script en tu máquina de desarrollo.)
#
# Uso:  bash claude-setup/install.sh

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

mkdir -p "$ROOT/.claude/agents" "$ROOT/.claude/hooks"

cp "$HERE/agents/reviewer.md" "$ROOT/.claude/agents/reviewer.md"
cp "$HERE/hooks/check.sh"     "$ROOT/.claude/hooks/check.sh"
chmod +x "$ROOT/.claude/hooks/check.sh" 2>/dev/null || true

if [ -f "$ROOT/.claude/settings.json" ]; then
  echo "! Ya existe .claude/settings.json — NO lo piso."
  echo "  Fusioná a mano el bloque \"hooks\" de claude-setup/settings.json."
else
  cp "$HERE/settings.json" "$ROOT/.claude/settings.json"
  echo "✔ .claude/settings.json creado (hook Stop)."
fi

echo "✔ .claude/agents/reviewer.md y .claude/hooks/check.sh instalados."
echo "→ Reiniciá Claude Code para que tome el reviewer y el hook."
