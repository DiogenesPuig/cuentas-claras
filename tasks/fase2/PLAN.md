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
- **Modelo de cuotas (installments): cada fila del resumen = un movimiento por la cuota cobrada ese mes.** Es decir, NO se guarda la compra completa con un plan a derivar; se guarda lo que el resumen efectivamente imputa en el período (`charged_on` = imputación del resumen). Se agregan a `transactions` dos columnas **nullables** `installment_n` / `installment_total` (ej. 2 y 3) solo para mostrar/agrupar. Ventaja: los reportes mensuales quedan correctos sin inventar montos futuros, y matchea cómo llega el dato desde el resumen. El dedupe (F2-4) trata cada `(compra, cuota n)` como distinta. Implementación: **F2-0** (migración previa a F2-3).

### Pendientes (diferidas, no bloquean)
- **Hosting del microservicio Python (afecta F2-1): diferido a F2-1.** Aclaración importante: **no puede correr en Supabase** — las Edge Functions son Deno (TS), no Python, y no soportan `pdfplumber`/`pytesseract`/el binario Tesseract. El micro va en un host aparte. **Default recomendado: Fly.io con `Dockerfile`** (soporta el binario nativo de Tesseract, free tier, simple). Alternativas: Railway/Render (PaaS desde repo). Se confirma al arrancar F2-1, que además viene después de F2-7.

## 4. Desglose de tickets (orden y dependencias)

| ID | Título | FR | Depende de | Notas |
|----|--------|----|-----------|-------|
| **F2-0** | Modelar cuotas: columnas `installment_n`/`installment_total` en `transactions` (migración) | soporte FR-16 | A2 | Decisión previa a F2-3 (ver §3). Migración chica + espejo en `schema_fase1.sql` + regenerar tipos. |
| **F2-7** | Visor de comprobantes (ver/descargar adjunto vía signed URL) | FR-10/FR-13 | B8 | **Sin infra nueva.** Solo UI (`<img>` / link a PDF) sobre `getAttachmentUrl`. Candidato a hacer primero. |
| **F2-1** | Microservicio Python: scaffold FastAPI + contrato `/v1/*` + auth JWT + deploy | infra F2 | Fase 1 cerrada + decisión de hosting | Cascarón fino; lógica pura testeable aparte. Define el contrato del §2. |
| **F2-3** | Parseo de resúmenes → tabla `staging` + pantalla de revisión/confirmación | FR-16 | F2-1, F2-0, B8 | Incluye **migración**: tabla `statement_staging`. Bancos objetivo: Nación y Patagonia (Visa/Master). |
| **F2-5** | Alta de medio desde el resumen (match por banco+red+last4+titular; si no existe, crear desde staging) | FR-16b | F2-3, B7 | Definir criterio de *match* contra `accounts`. |
| **F2-4** | Detección de duplicados al importar (monto+fecha+comercio → `external_hash`) | FR-17 | F2-3 | Reusa `transactions.external_hash`. |
| **F2-6** | Sugerencia automática de categoría según descripción/comercio | FR-19 | F2-3, B6 | Empezar con reglas/keywords; IA opcional después. |
| **F2-2** | OCR de comprobantes: extraer monto/fecha/comercio y precargar el alta | FR-14 | F2-1, B8 | Reusa el endpoint `/v1/receipts:extract`. OCR on-box con **Tesseract** (decidido). |

**Secuencia recomendada:** F2-7 (rápido, sin infra) → F2-1 (habilita todo lo demás) → F2-0 (migración cuotas, previa a F2-3) → F2-3 → {F2-4, F2-5, F2-6 en paralelo} → F2-2.

## 5. Riesgos / cosas a vigilar

- **Calidad del parseo por banco:** cada banco/red tiene un layout distinto; F2-3 arranca con 2 bancos y se amplía.
- **Referencia vs. fixtures de test (privacidad):**
  - **Referencia local (real, privada):** `samples/resumenes-privados/` — resúmenes reales del dueño para construir/probar parsers a mano. Está en `.gitignore`; **nunca se commitea** (datos personales). Ver su README.
  - **Fixtures de test (versionables):** los `pytest` corren contra resúmenes **anonimizados/sintéticos**, no contra los privados. Definir esa estrategia en F2-3.
- **Seguridad del parseo (input no confiable):** el micro recibe PDFs/imágenes de cualquiera. Aplicar límites de tamaño y tiempo, no ejecutar contenido embebido, cuidar zip-bombs/PDFs maliciosos, parsear en proceso acotado. A bakear en F2-1 (límites/timeouts del endpoint) y F2-3 (parser defensivo).
- **Extensiones en un mismo resumen:** un PDF puede mezclar titular + extensiones; F2-5 debe poder crear cada extensión como medio propio (FR-6c).
- **Costo/latencia del OCR cloud** si algún día se reabre esa vía en F2-2 (hoy: Tesseract on-box).
- **No persistir nunca la password** del PDF (revisar en review de F2-3).

## 6. Tareas adicionales detectadas (brainstorm 2026-06-22)

Detectadas al planificar Fase 2. Algunas **desbloquean o protegen** Fase 2 y conviene saldarlas pronto; otras son ideas a futuro. Cuando se trabajen, se materializan como tickets propios.

### Conviene hacerlas pronto (desbloquean/protegen Fase 2)
- **D17 — CI en GitHub Actions.** Correr `typecheck`/`lint`/`test` en cada PR (hoy se hace a mano). Cuando exista el micro, sumar `pytest`/`ruff`. Independiente, barato, alto valor ahora que se mergean PRs seguido. _Sprint D · Sonnet._
- ~~**Modelar cuotas (installments)**~~ → **RESUELTO** (ver §3 Resueltas). Se implementa en **F2-0** (migración previa a F2-3): columnas nullables `installment_n`/`installment_total` en `transactions`. Nota relacionada de las muestras: un mismo resumen mezcla **varias tarjetas/titulares** (impacta FR-16b/F2-5) y trae **secciones `$` y `U$S`** (multimoneda por fila). Detalle de formato en `F2-3` → "Hallazgos de formato".
- **FX fallback a día hábil anterior.** Hoy una compra en fin de semana/feriado no tiene cotización de ese día y cae en `missingRates` (C13). Falta usar la cotización del **día hábil anterior**. Lógica pura en `lib/fx.ts` + ajuste en `api.ts`. Mejora de correctitud del dinero. _Sprint C/calidad · Sonnet._
- **Auditoría de precisión de montos.** Verificar que los montos no se manejen como `float` lossy (un `0.1 + 0.2` en una app de plata es un bug). Confirmar tipo en Postgres (`numeric`) y cómo viaja a JS; decidir representación (entero en centavos / decimal). Chico pero crítico. _Sprint calidad · Opus decide representación → Sonnet._

### Ideas a futuro (no urgentes)
- **Onboarding "upload-first":** flujo de entrada centrado en "subí tu resumen y listo" (PRD FR-16b: muchos usuarios no cargarán medios a mano).
- **PWA / instalable:** mencionada en el PRD §9.3, no hecha en Fase 1.
- **Export/borrado de datos del usuario:** "descargá/borrá mis datos" cuando haya usuarios reales (C14 ya exporta movimientos a CSV como base).
