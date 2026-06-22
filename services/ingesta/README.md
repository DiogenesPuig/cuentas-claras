# services/ingesta — Microservicio de ingesta (FastAPI)

OCR de comprobantes (FR-14) y parseo de resúmenes de tarjeta (FR-16), desacoplado
del front y de Supabase. **Stateless: no toca la base.** Recibe un archivo (+ password
opcional) y devuelve JSON con lo extraído; la web es quien escribe en la DB bajo RLS.

Decisiones (ver `tasks/fase2/PLAN.md`): hosting **Fly.io + Docker**; OCR on-box con
**Tesseract**; auth validando el **JWT de Supabase** (sin consultar la DB).

## Por qué un micro aparte (y no una Edge Function)

Las Edge Functions de Supabase son Deno (TS) y no soportan `pytesseract`/`pdfplumber`
ni el binario nativo de Tesseract. Por eso va en un host con Docker.

## Estructura

```
app/
  main.py            cascarón FastAPI: CORS + registro de routers
  config.py          settings desde el entorno (auth, CORS, límites)
  auth.py            validación del JWT de Supabase (HS256 o JWKS) — no toca la DB
  schemas.py         contrato HTTP (pydantic): forma de las respuestas
  uploads.py         endurecimiento: límite de tamaño + timeout de procesado
  ocr.py             borde IO: bytes (imagen) → texto (Tesseract, lazy) (F2-2)
  pdf.py             borde IO: bytes (PDF) → texto (pdfplumber, lazy; password en memoria) (F2-3)
  routes/
    health.py        GET  /v1/health (público)
    receipts.py      POST /v1/receipts:extract (FR-14) — OCR (ocr.py) + heurística pura
    statements.py    POST /v1/statements:parse (FR-16) — pdf.py + dispatcher de parseo
  parsing/           LÓGICA PURA (sin FastAPI/red/IO), testeable y portable
    receipts.py      extract_from_text(text) → ReceiptExtraction: monto/fecha/comercio (F2-2)
    statements.py    parse_statement_text(text) → StatementParse: dispatcher por plantilla (F2-3)
    patagonia.py     parser tabular Patagonia (Visa/Master/CR): filas por tarjeta, cuotas, pagos (F2-3)
    nativa_nacion.py parser Nativa-Nación (Mastercard, Banco Nación): grupos por titular/adicional (F2-3b)
tests/               pytest: health, auth, contrato, límite, comprobantes (F2-2) y resúmenes (F2-3/F2-3b)
  fixtures/          textos ANONIMIZADOS de resúmenes para los tests (nunca PDFs reales)
Dockerfile           Python 3.12 + Tesseract (es/en)
run-local.sh         corre el micro local + Cloudflare Quick Tunnel (URL pública)
pyproject.toml       deps + ruff + pytest
```

## Contrato (`/v1/`, versionado en el path)

- `POST /v1/receipts:extract` (multipart: `file`) → `{ amount, currency, date, merchant, confidence }`
- `POST /v1/statements:parse` (multipart: `file`, `password?`) →
  `{ statement_close_on, cards: [{ account_hint: { bank, network, last4, holder }, rows: [{ occurred_on, description, amount, currency, installment?, kind }] }] }`
  (`kind`: `"charge"` | `"payment"`)

Todos (salvo `/v1/health`) exigen `Authorization: Bearer <access_token de Supabase>`.

## Auth

El micro valida la **firma** del JWT, no consulta la DB. Dos modos por config:
- `SUPABASE_JWT_SECRET` seteado → HS256 (secret legacy del proyecto).
- Solo `SUPABASE_URL` → JWKS (RS256/ES256) contra `…/auth/v1/.well-known/jwks.json` (recomendado).

## Seguridad del parseo (input no confiable)

Recibe archivos de cualquiera: hay límite de tamaño al leer (`MAX_UPLOAD_BYTES`, corta
en streaming) y timeout de procesado (`PROCESS_TIMEOUT_SECONDS`, el parseo corre en un
thread acotado). La password de un PDF protegido se usa en memoria y **nunca se persiste**.

## Desarrollo

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"        # agregar [ocr] para correr el OCR real (F2-2)
cp .env.example .env           # completar SUPABASE_*
pytest                         # tests
ruff check .                   # lint
uvicorn app.main:app --reload  # http://localhost:8000/v1/health
```

## Correr local + túnel (vía elegida — sin cuenta ni tarjeta)

Corre el micro en tu máquina y lo expone con una URL HTTPS pública vía Cloudflare
Quick Tunnel (no requiere cuenta ni tarjeta). Sirve mientras la PC está prendida.

1. **Instalar cloudflared** (una vez):
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
     -o /tmp/cloudflared && sudo install /tmp/cloudflared /usr/local/bin/cloudflared
   cloudflared --version
   ```
2. **(Opcional, para OCR real) instalar Tesseract:**
   ```bash
   sudo apt update && sudo apt install -y tesseract-ocr tesseract-ocr-spa
   ```
3. **Config:** `cp .env.example .env` y completar `SUPABASE_JWT_SECRET` (o `SUPABASE_URL`)
   y `WEB_ORIGIN` (el origen de tu web, ej. `http://localhost:5173`).
4. **Levantar todo:**
   ```bash
   ./run-local.sh
   ```
   Imprime una URL `https://<algo>.trycloudflare.com`. Probá:
   `curl https://<algo>.trycloudflare.com/v1/health`.
5. En la web: `VITE_INGESTA_URL=https://<algo>.trycloudflare.com`.

> La URL del Quick Tunnel **cambia cada vez** que reiniciás el túnel. Para una URL
> estable hace falta un túnel con nombre (requiere cuenta Cloudflare free + un dominio).

## Deploy (Hugging Face Spaces — alternativa 24/7, sin tarjeta)

Para una URL estable que no dependa de tu PC. Gratis y sin tarjeta (CPU básico con
buena RAM, ideal para OCR). El Space es **público** por defecto: no es problema, el
micro igual valida el JWT de Supabase en cada request.

1. En huggingface.co → **New Space** → SDK **Docker** → visibilidad Public.
2. Subí el contenido de `services/ingesta/` al repo del Space (incluido el `Dockerfile`).
   El Space necesita escuchar en el puerto `7860`: agregá `app_port: 7860` en el
   frontmatter YAML del `README.md` del Space, o exponé ese puerto. El `CMD` ya lee
   `$PORT`, así que con `app_port: 7860` (HF setea `PORT=7860`) levanta solo.
3. En **Settings → Variables and secrets** del Space:
   - Secret `SUPABASE_JWT_SECRET=<tu JWT secret de Supabase>` (o `SUPABASE_URL` para JWKS).
   - Variable `WEB_ORIGIN=http://localhost:5173` (sumá el dominio de tu web cuando lo tengas).
4. El Space buildea solo. Smoke test: `curl https://<user>-<space>.hf.space/v1/health`.
5. En la web: `VITE_INGESTA_URL=https://<user>-<space>.hf.space`.

## Estado

- **F2-1:** scaffold + contrato + auth + endurecimiento + tests.
- **F2-2:** `POST /v1/receipts:extract` implementado — OCR con Tesseract (`ocr.py`) +
  heurística de extracción (monto cerca de "TOTAL", fecha, comercio; detecta el
  subtipo *comprobante de transferencia*). Si faltan las deps `[ocr]` o el OCR
  falla, devuelve confianza 0 (la web cae a carga manual).
- **F2-3:** `POST /v1/statements:parse` implementado para el layout **tabular de
  Patagonia** (Visa/Master/CR): extrae texto del PDF (`pdf.py`, con password en
  memoria), agrupa filas por tarjeta (last4 + titular), detecta cuotas y
  pagos/devoluciones, y devuelve `{ statement_close_on, cards[] }`.
- **F2-3b:** `nativa_nacion.py` suma el layout **Nativa-Nación** (Mastercard, Banco
  Nación) al dispatcher. La capa de texto del PDF sale legible, así que el parser
  trabaja sobre texto (no por coordenadas, como se preveía): toma el cierre de
  "Estado de cuenta al", agrupa el detalle por `TOTAL TITULAR`/`TOTAL ADICIONAL`
  (una tarjeta por titular y adicional, FR-6c) e ignora el consolidado/SU PAGO.
  El PAN no aparece en el texto → `last4` queda None (F2-5 matchea por titular).
