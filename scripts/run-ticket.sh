#!/usr/bin/env bash
#
# run-ticket.sh — Runner headless por ticket para Cuentas Claras.
#
# Corre un ticket del backlog con Claude Code en modo headless (claude -p),
# eligiendo el modelo correcto automáticamente (según scripts/backlog.tsv),
# valida con typecheck/lint/test si existen y, si pasa, hace un commit del ticket.
# Si algo falla, NO commitea y se detiene.
#
# Uso:
#   scripts/run-ticket.sh A1                 # corre el ticket A1
#   scripts/run-ticket.sh --all              # corre TODO el backlog en orden (desatendido)
#   scripts/run-ticket.sh A3 --model opus    # forza un modelo para esta corrida
#   scripts/run-ticket.sh B6 --dry-run       # muestra qué haría, sin ejecutar
#   scripts/run-ticket.sh A1 --no-commit     # no commitea (solo implementa y valida)
#   scripts/run-ticket.sh A1 --yolo          # salta permisos (autonomía total; ver nota)
#
# Variables de entorno:
#   CLAUDE_BIN   binario de Claude Code (default: claude)
#   CLAUDE_PERM  flags de permisos (default: --permission-mode acceptEdits)
#
# NOTA sobre permisos: muchos tickets necesitan correr comandos (npm, supabase).
# Con el default (acceptEdits) Claude puede pedir confirmación para esos comandos.
# Para correr 100% desatendido usá --yolo (equivale a --dangerously-skip-permissions).
# Usalo solo en este repo/proyecto, nunca en algo sensible.

set -euo pipefail

# --- ubicación del repo (raíz = carpeta padre de scripts/) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKLOG="$SCRIPT_DIR/backlog.tsv"
LOG_DIR="$SCRIPT_DIR/logs"

CLAUDE_BIN="${CLAUDE_BIN:-claude}"
CLAUDE_PERM="${CLAUDE_PERM:---permission-mode acceptEdits}"

# --- colores ---
c_reset='\033[0m'; c_bold='\033[1m'; c_red='\033[31m'; c_grn='\033[32m'; c_yel='\033[33m'; c_blu='\033[34m'
say()  { echo -e "${c_blu}▶${c_reset} $*"; }
ok()   { echo -e "${c_grn}✔${c_reset} $*"; }
warn() { echo -e "${c_yel}!${c_reset} $*"; }
err()  { echo -e "${c_red}x${c_reset} $*" >&2; }

usage() { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# --- parseo de argumentos ---
TICKET=""; RUN_ALL=0; DRY=0; DO_COMMIT=1; MODEL_OVERRIDE=""; YOLO=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all|--unattended) RUN_ALL=1 ;;
    --dry-run)          DRY=1 ;;
    --no-commit)        DO_COMMIT=0 ;;
    --yolo)             YOLO=1 ;;
    --model)            MODEL_OVERRIDE="${2:-}"; shift ;;
    -h|--help)          usage ;;
    -*)                 err "Opción desconocida: $1"; exit 2 ;;
    *)                  TICKET="$1" ;;
  esac
  shift
done

[[ $YOLO -eq 1 ]] && CLAUDE_PERM="--dangerously-skip-permissions"

[[ -f "$BACKLOG" ]] || { err "No encuentro $BACKLOG"; exit 1; }
command -v "$CLAUDE_BIN" >/dev/null 2>&1 || { err "No encuentro '$CLAUDE_BIN' en el PATH. Instalá Claude Code o seteá CLAUDE_BIN."; exit 1; }
mkdir -p "$LOG_DIR"

# --- busca una columna del backlog para un id dado ---
lookup() { # $1=id $2=colnum
  awk -F '\t' -v id="$1" -v col="$2" 'NR>1 && $1==id {print $col; found=1} END{ if(!found) exit 3 }' "$BACKLOG"
}

# --- corre los chequeos si existen (no falla si no hay package.json todavía) ---
run_checks() {
  cd "$ROOT_DIR"
  if [[ ! -f package.json ]]; then
    warn "No hay package.json todavía: salto typecheck/lint/test."
    return 0
  fi
  local ok_all=0
  for s in typecheck lint test; do
    if npm run | grep -qE "^[[:space:]]*$s$"; then
      say "npm run $s"
      if ! npm run "$s" --silent; then err "Falló: npm run $s"; ok_all=1; fi
    fi
  done
  return $ok_all
}

# --- implementa un ticket ---
run_one() { # $1=id
  local id="$1" model file subject prompt log
  model="$(lookup "$id" 2)" || { err "Ticket '$id' no está en backlog.tsv"; return 1; }
  file="$(lookup "$id" 4)"
  subject="$(lookup "$id" 5)"
  [[ -n "$MODEL_OVERRIDE" ]] && model="$MODEL_OVERRIDE"
  [[ -f "$ROOT_DIR/$file" ]] || { err "No encuentro el ticket: $file"; return 1; }

  echo
  echo -e "${c_bold}── Ticket $id ── modelo: $model ── $file${c_reset}"

  read -r -d '' prompt <<EOF || true
Sos un implementador del proyecto "Cuentas Claras".
Leé CLAUDE.md y el ticket $file, e implementá ÚNICAMENTE ese ticket,
respetando sus criterios de aceptación y las reglas de CLAUDE.md
(incluida la convención de "índice por carpeta": actualizá el README.md
de cada carpeta que toques).

NO hagas git commit: de eso se encarga el script que te invoca.

Si aparece una decisión NO resuelta (dependencia nueva fuera del stack,
cambio de esquema, patrón nuevo o ambigüedad en los criterios), NO improvises:
dejá una nota "// DECISIÓN PENDIENTE: ..." en el código y, al final de tu
respuesta, listá claramente qué quedó para escalar.
EOF

  if [[ $DRY -eq 1 ]]; then
    warn "[dry-run] $CLAUDE_BIN -p $CLAUDE_PERM --model $model \"<prompt del ticket $id>\""
    return 0
  fi

  log="$LOG_DIR/$(date +%Y%m%d-%H%M%S)-$id.log"
  say "Ejecutando Claude Code (headless)… log: ${log#$ROOT_DIR/}"
  cd "$ROOT_DIR"
  # shellcheck disable=SC2086
  if ! "$CLAUDE_BIN" -p $CLAUDE_PERM --model "$model" "$prompt" | tee "$log"; then
    err "Claude Code terminó con error en $id. Revisá el log."
    return 1
  fi

  if ! run_checks; then
    err "Chequeos fallidos en $id. NO se commitea. Revisá y corregí (podés re-correr el ticket)."
    return 1
  fi

  if [[ $DO_COMMIT -eq 1 ]]; then
    cd "$ROOT_DIR"
    if [[ -n "$(git status --porcelain)" ]]; then
      git add -A
      git commit -m "feat($id): $subject" -m "Implementa el ticket $file (modelo: $model)." >/dev/null
      ok "Commit: feat($id): $subject"
    else
      warn "Sin cambios para commitear en $id."
    fi
  fi
  ok "Ticket $id listo."
}

# --- main ---
if [[ $RUN_ALL -eq 1 ]]; then
  warn "Modo desatendido: corro TODO el backlog en orden. Ctrl-C para abortar."
  while IFS=$'\t' read -r id _rest; do
    [[ "$id" == "id" || -z "$id" ]] && continue
    run_one "$id" || { err "Me detengo en $id (no sigo con los que dependen de él)."; exit 1; }
  done < "$BACKLOG"
  ok "Backlog completo."
else
  [[ -n "$TICKET" ]] || { err "Faltó el id del ticket. Ej: scripts/run-ticket.sh A1   (o --all)"; exit 2; }
  run_one "$TICKET"
fi
