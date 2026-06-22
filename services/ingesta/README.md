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
  ocr.py             borde IO: bytes (imagen/PDF) → texto (Tesseract/pdfplumber, lazy) (F2-2)
  routes/
    health.py        GET  /v1/health (público)
    receipts.py      POST /v1/receipts:extract (FR-14) — OCR (ocr.py) + heurística pura
    statements.py    POST /v1/statements:parse (FR-16) — cascarón, parseo en F2-3
  parsing/           LÓGICA PURA (sin FastAPI/red/IO), testeable y portable
    receipts.py      extract_from_text(text) → ReceiptExtraction: monto/fecha/comercio (F2-2)
    statements.py    parse_statement(bytes, password?) → StatementParse (stub F2-1)
tests/               pytest: health, auth, contrato, límite, y heurística de comprobantes (F2-2)
Dockerfile           Python 3.12 + Tesseract (es/en)
fly.toml             deploy en Fly.io
pyproject.toml       deps + ruff + pytest
```

## Contrato (`/v1/`, versionado en el path)

- `POST /v1/receipts:extract` (multipart: `file`) → `{ amount, currency, date, merchant, confidence }`
- `POST /v1/statements:parse` (multipart: `file`, `password?`) →
  `{ account_hint: { bank, network, last4, holder }, rows: [{ occurred_on, description, amount, currency, installment? }] }`

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

## Deploy (Google Cloud Run)

El mismo `Dockerfile` sirve (el `CMD` escucha en `$PORT`, que Cloud Run inyecta).
Se buildea en la nube con Cloud Build (no hace falta Docker local):

```bash
# 1. Setup (una vez)
gcloud auth login
gcloud config set project TU_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

# 2. Guardar el JWT secret de Supabase en Secret Manager (no en la config del servicio)
printf '%s' 'TU_SUPABASE_JWT_SECRET' | gcloud secrets create supabase-jwt-secret --data-file=-

# 3. Deploy desde services/ingesta/ (Cloud Build buildea el Dockerfile)
gcloud run deploy cuentas-claras-ingesta \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --max-instances 2 \
  --set-env-vars WEB_ORIGIN=https://TU-WEB,http://localhost:5173 \
  --set-secrets SUPABASE_JWT_SECRET=supabase-jwt-secret:latest

# 4. Smoke test (la URL la imprime el deploy)
curl https://cuentas-claras-ingesta-XXXX.a.run.app/v1/health
```

`--allow-unauthenticated` deja entrar requests del browser; la autorización real la
hace el micro validando el JWT de Supabase (no es un endpoint abierto). Alternativa a
HS256: `--set-env-vars SUPABASE_URL=https://TU-PROYECTO.supabase.co` (valida vía JWKS).

> `fly.toml` queda como alternativa de hosting (Fly.io), pero el deploy soportado/free
> elegido es Cloud Run.

## Estado

- **F2-1:** scaffold + contrato + auth + endurecimiento + tests.
- **F2-2:** `POST /v1/receipts:extract` implementado — OCR con Tesseract (`ocr.py`) +
  heurística de extracción (monto cerca de "TOTAL", fecha, comercio; detecta el
  subtipo *comprobante de transferencia*). Si faltan las deps `[ocr]` o el OCR
  falla, devuelve confianza 0 (la web cae a carga manual).
- **F2-3 (pendiente):** `POST /v1/statements:parse` todavía es stub.
