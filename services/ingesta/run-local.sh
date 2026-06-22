#!/usr/bin/env bash
# Corre el micro local + un Quick Tunnel de Cloudflare (URL pública HTTPS, sin
# cuenta ni tarjeta). Pensado para usar el sitio mientras esta PC está prendida.
#
# Requisitos (ver README → "Correr local + túnel"):
#   - Python 3.11+  (crea el venv .venv la primera vez)
#   - cloudflared instalado en el PATH
#   - (opcional, para OCR real) binario de Tesseract: sudo apt install tesseract-ocr tesseract-ocr-spa
#   - un archivo .env con SUPABASE_JWT_SECRET (o SUPABASE_URL) y WEB_ORIGIN
#
# Uso:  ./run-local.sh           (puerto por defecto 8000)
#       PORT=9000 ./run-local.sh

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

# 1. venv + deps (incluye el extra ocr para el OCR real).
if [ ! -d .venv ]; then
  echo "→ Creando venv e instalando dependencias…"
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet -e ".[ocr]"
fi

if [ ! -f .env ]; then
  echo "✗ Falta .env. Copialo de .env.example y completá SUPABASE_JWT_SECRET / WEB_ORIGIN."
  exit 1
fi

command -v cloudflared >/dev/null || {
  echo "✗ cloudflared no está instalado. Ver README → 'Correr local + túnel'."
  exit 1
}

command -v tesseract >/dev/null || echo "⚠ Tesseract no está instalado: el OCR devolverá confianza 0 (instalá tesseract-ocr para extraer datos)."

# 2. Levantar uvicorn en background y matarlo al salir.
echo "→ Levantando el micro en http://127.0.0.1:${PORT} …"
./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "${PORT}" &
UVICORN_PID=$!
trap 'echo; echo "→ Cerrando…"; kill "${UVICORN_PID}" 2>/dev/null || true' EXIT

# Esperar a que responda el health.
for _ in $(seq 1 30); do
  curl -sf "http://127.0.0.1:${PORT}/v1/health" >/dev/null 2>&1 && break
  sleep 0.3
done
echo "→ Micro arriba. Abriendo túnel público (la URL https://...trycloudflare.com aparece abajo)…"
echo

# 3. Quick Tunnel: imprime la URL pública. Ctrl+C corta todo.
cloudflared tunnel --url "http://127.0.0.1:${PORT}"
