# Plan de Fase 2 — Ingesta inteligente

> Resultado de la sesión de planificación (2026-06-22). Convierte el parking lot de
> `tasks/fase2/README.md` en un plan ejecutable: arquitectura, decisiones resueltas,
> decisiones pendientes (del usuario) y el desglose de tickets con dependencias.
> Cuando se confirmen las decisiones pendientes, cada ticket de abajo se materializa
> como archivo propio en `tasks/` siguiendo la plantilla de `tasks/README.md`.

## 1. Qué ya está listo (no hay que rehacerlo)

El esquema de Fase 1 se diseñó anticipando Fase 2. Ya existe:

- **Subida de adjuntos (FR-13/FR-15):** `uploadAttachment` (bucket privado `attachments`, path `{workspaceId}/…`) y `getAttachmentUrl(path)` → signed URL de 5 min. Tabla `attachments` con `file_type`, `kind` (`receipt`|`statement`), `status` (`uploaded`|`processed`|`failed`).
- **`accounts.last4`** (`char(4)`) → identificación del medio (FR-16b).
- **Enums:** `transaction_source` ya incluye `'ocr'` y `'statement_import'`; `attachment_kind`/`attachment_status` cubren el ciclo de procesado.
- **`transactions.external_hash`** → clave de dedupe (FR-17).

Falta a nivel datos: una **tabla de staging** para movimientos parseados de un resumen, pendientes de confirmación (la agrega F2-3).

## 2. Arquitectura (resuelta como arquitecto)

Según PRD §9.2 (Opción C) y §9.3: la ingesta pesada (OCR + parseo de PDFs) vive en un **microservicio Python (FastAPI)** desacoplado del front y de Supabase. Decisiones de diseño tomadas para respetar la regla de portabilidad de `CLAUDE.md`:

- **Microservicio *stateless* (no toca la DB).** Recibe el archivo (+ password si aplica), devuelve **JSON** con lo extraído. **No tiene credenciales de la base.** La web es quien escribe en `staging`/`transactions` vía `supabase-js`, **bajo la RLS del usuario**. Así:
  - RLS sigue siendo la única fuente de verdad de seguridad (no hay `service_role` en el micro).
  - El micro es 100% portable: el día que se cambie de backend, sigue siendo "PDF/imagen → JSON".
  - La lógica pura de parseo (sin FastAPI/IO) va en módulos testeables aparte (espejo de la regla de "cascarón fino" de las edge functions).
- **Auth web → micro:** la web manda el **access token de Supabase** (JWT) en `Authorization: Bearer`; el micro valida la firma contra el JWKS del proyecto (sin consultar la DB). Solo autentica/autoriza la llamada; no lee datos del usuario.
- **PDFs de resumen protegidos con contraseña:** la web pide la password en el upload y la manda en el `multipart`; el micro **descifra en memoria y nunca la persiste**. Si falla el desbloqueo → error → la web marca `attachment_status = 'failed'` y ofrece reintentar.
- **Contrato (borrador):**
  - `POST /v1/receipts:extract` → `{ amount, currency, date, merchant, confidence }` (FR-14).
  - `POST /v1/statements:parse` (multipart: file + password?) → `{ account_hint: { bank, network, last4, holder }, rows: [{ occurred_on, description, amount, currency, installment? }] }` (FR-16).
  - Versionado en el path (`/v1/`) para poder evolucionar el contrato sin romper la web.

## 3. Decisiones

### Resueltas
- **Motor de OCR para comprobantes (FR-14/F2-2): On-box `Tesseract` (`pytesseract`).** Corre dentro del propio microservicio, sin API keys ni costo por uso. Calidad media (puede flaquear con fotos malas); si más adelante hace falta más precisión se evalúa un motor cloud, pero se arranca on-box. El parseo de resúmenes PDF (F2-3) usa `pdfplumber` sobre la capa de texto y **no necesita OCR**.

### Pendientes (diferidas, no bloquean)
- **Hosting del microservicio Python (afecta F2-1): diferido a F2-1.** Aclaración importante: **no puede correr en Supabase** — las Edge Functions son Deno (TS), no Python, y no soportan `pdfplumber`/`pytesseract`/el binario Tesseract. El micro va en un host aparte. **Default recomendado: Fly.io con `Dockerfile`** (soporta el binario nativo de Tesseract, free tier, simple). Alternativas: Railway/Render (PaaS desde repo). Se confirma al arrancar F2-1, que además viene después de F2-7.

## 4. Desglose de tickets (orden y dependencias)

| ID | Título | FR | Depende de | Notas |
|----|--------|----|-----------|-------|
| **F2-7** | Visor de comprobantes (ver/descargar adjunto vía signed URL) | FR-10/FR-13 | B8 | **Sin infra nueva.** Solo UI (`<img>` / link a PDF) sobre `getAttachmentUrl`. Candidato a hacer primero. |
| **F2-1** | Microservicio Python: scaffold FastAPI + contrato `/v1/*` + auth JWT + deploy | infra F2 | Fase 1 cerrada + decisión de hosting | Cascarón fino; lógica pura testeable aparte. Define el contrato del §2. |
| **F2-3** | Parseo de resúmenes → tabla `staging` + pantalla de revisión/confirmación | FR-16 | F2-1, B8 | Incluye **migración**: tabla `statement_staging`. Bancos objetivo: Nación y Patagonia (Visa/Master). |
| **F2-5** | Alta de medio desde el resumen (match por banco+red+last4+titular; si no existe, crear desde staging) | FR-16b | F2-3, B7 | Definir criterio de *match* contra `accounts`. |
| **F2-4** | Detección de duplicados al importar (monto+fecha+comercio → `external_hash`) | FR-17 | F2-3 | Reusa `transactions.external_hash`. |
| **F2-6** | Sugerencia automática de categoría según descripción/comercio | FR-19 | F2-3, B6 | Empezar con reglas/keywords; IA opcional después. |
| **F2-2** | OCR de comprobantes: extraer monto/fecha/comercio y precargar el alta | FR-14 | F2-1, B8 | Reusa el endpoint `/v1/receipts:extract`. OCR on-box con **Tesseract** (decidido). |

**Secuencia recomendada:** F2-7 (rápido, sin infra) → F2-1 (habilita todo lo demás) → F2-3 → {F2-4, F2-5, F2-6 en paralelo} → F2-2.

## 5. Riesgos / cosas a vigilar

- **Calidad del parseo por banco:** cada banco/red tiene un layout distinto; F2-3 arranca con 2 bancos y se amplía. Tener fixtures (PDFs de ejemplo anonimizados) para tests de la lógica pura.
- **Extensiones en un mismo resumen:** un PDF puede mezclar titular + extensiones; F2-5 debe poder crear cada extensión como medio propio (FR-6c).
- **Costo/latencia del OCR cloud** si se elige esa vía en F2-2.
- **No persistir nunca la password** del PDF (revisar en review de F2-3).
