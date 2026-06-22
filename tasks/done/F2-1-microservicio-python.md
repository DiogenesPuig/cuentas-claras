# F2-1 Microservicio Python de ingesta (scaffold + contrato + deploy)

**Sprint:** Fase 2 · **Modelo sugerido:** Opus (decide infra/contrato) → Sonnet (ejecuta) · **Depende de:** Fase 1 cerrada + decisión de hosting

## Objetivo
Levantar el microservicio Python (FastAPI) que hace OCR/parseo, desacoplado del front y de Supabase. Define el contrato HTTP que consumirán F2-2 (comprobantes) y F2-3 (resúmenes), la autenticación, y el deploy. Es el cascarón fino: la lógica pura de parseo vive en módulos testeables aparte.

## Contexto (links a docs)
- `tasks/fase2/PLAN.md` §2 (arquitectura, contrato, auth, portabilidad) y §3 (hosting pendiente).
- PRD §9.2 Opción C (Python para OCR/parseo) y §9.1 (servicios de ingesta desacoplados).
- `CLAUDE.md` → regla de portabilidad ("cascarón fino", lógica pura sin imports de runtime) y "Política de modelos" (escalado de decisiones).

## DECISIÓN PENDIENTE (resolver al arrancar)
- **Hosting.** Default recomendado: **Fly.io + `Dockerfile`** (soporta el binario nativo de Tesseract, free tier). Alternativas: Railway/Render. **No puede ser Supabase** (Edge Functions = Deno, no Python). Confirmar antes de deployar.

## Archivos a crear/editar
- Nuevo repo/carpeta del micro (ej. `services/ingesta/`): `app/main.py` (FastAPI, cascarón), `app/auth.py` (validación JWT Supabase vía JWKS), `app/parsing/` (lógica pura, sin FastAPI/IO), `tests/`, `Dockerfile`, `pyproject.toml`/`requirements.txt`, `README.md`.
- Lado web: `src/lib/ingesta.ts` o `src/features/<dominio>/api.ts` con el cliente HTTP del micro (única capa que lo llama), `.env` con la base URL del micro.

## Pasos
1. Scaffold FastAPI con health check `GET /v1/health`.
2. Definir el contrato (esqueleto, sin lógica real todavía):
   - `POST /v1/receipts:extract` → `{ amount, currency, date, merchant, confidence }`.
   - `POST /v1/statements:parse` (multipart: file + password?) → `{ account_hint, rows[] }`.
3. Auth: middleware que valida el **access token de Supabase** (firma vía JWKS del proyecto); rechaza sin token válido. El micro **no** consulta la DB.
4. Estructura para lógica pura testeable (`app/parsing/*.py` sin imports de red) + `pytest` + `ruff`.
5. `Dockerfile` con Python + Tesseract instalado. Deploy al hosting elegido; smoke test del health y de un endpoint dummy desde la web.
6. CORS configurado para el origen de la web.
7. Endurecer el endpoint contra input no confiable: límite de tamaño de archivo, timeout de procesado, y aislamiento del parseo (ver `tasks/fase2/PLAN.md` §5 "Seguridad del parseo").

## Criterios de aceptación
- [ ] El micro deployado responde `GET /v1/health` y rechaza requests sin JWT válido.
- [ ] Contrato `/v1/receipts:extract` y `/v1/statements:parse` definido y documentado (aunque devuelva stub).
- [ ] La lógica de parseo vive en módulos sin imports de FastAPI/red, con `pytest` corriendo en CI/local.
- [ ] La web tiene un único módulo que habla con el micro (no se llama desde componentes).
- [ ] El micro **no** tiene credenciales de la DB (`service_role`) ni escribe en Postgres.

## Fuera de alcance
- La lógica real de OCR (F2-2) y de parseo de resúmenes (F2-3): acá solo el esqueleto y el contrato.

## Tests
- `pytest` del scaffold (health, auth rechaza/acepta token, forma del contrato). Lado web: el cliente HTTP mockeado.

## Por qué este modelo
Opus decide hosting y contrato (caros de revertir, atan el resto de Fase 2); Sonnet ejecuta el scaffold una vez definidos.
