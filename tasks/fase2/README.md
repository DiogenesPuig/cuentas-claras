# Backlog — Fase 2 (Ingesta inteligente)

> **Planificada (2026-06-22).** Fase 1 está cerrada. El plan de arquitectura y decisiones está en
> `PLAN.md`. La mayoría depende del microservicio Python (`F2-1`); `F2-7` no necesita infra nueva.
>
> **Estado (2026-06-23):** ✅ F2-0, F2-1, F2-2 (PR #18); ✅ F2-3 (Patagonia tabular, + reintegros como
> gasto negativo), ✅ F2-3b (Nativa-Nación), ✅ F2-4 (dedupe), ✅ F2-5 (medio desde el resumen),
> ✅ F2-6 (sugerencia de categoría), ✅ F2-7 (visor), ✅ F2-8 (origen/destino en el micro),
> ✅ F2-9 (medio de transferencia + atribución por persona en el front) y
> ✅ F2-10 (dedup de persona en reportes por `owner_member_id`).
> ✅ F2-12 (parser universal de comprobantes: Fase A regex/OCR + Fase B fallback por visión Gemini, PR #29).
> **Pendiente: F2-13 (aviso de duplicado al dar de alta un movimiento).**
> ✅ F2-11 (transferencia por persona): un único medio `'transfer'` por persona (lazy), banco del
> movimiento en `transactions.bank`. **Follow-up pendiente (coordinación con F2-10, ya mergeado):**
> la dimensión "banco" de reportes (`features/reports/aggregate.ts`) y la columna "Banco" de
> exportar CSV (`features/transactions/export.ts`) leen `account.bank`, que ahora es `null` para
> transferencias (el banco vive en `transactions.bank`); hay que sumar `tx.bank ?? account?.bank`
> para que esos movimientos no queden con banco vacío en reportes/export.
> Los tickets completados se movieron a `tasks/done/` (ver allí su estado/criterios).

## Archivos de esta carpeta

- `PLAN.md` — plan de Fase 2: arquitectura, decisiones (resueltas y pendientes), desglose y orden.
- `F2-13-aviso-duplicado-alta.md` — aviso suave (no bloqueo) al dar de alta un movimiento si ya existe
  uno igual/parecido: hash exacto del comprobante + heurística monto+fecha(±2d)+medio/descr. Suma columna
  `attachments.content_hash`. _Depende de F2-2, B8; distinto de F2-4 (resúmenes, bloqueo duro)._

Completados (en `tasks/done/`): `F2-0-modelar-cuotas`, `F2-1-microservicio-python`,
`F2-2-ocr-comprobantes`, `F2-3-parseo-resumenes-staging`, `F2-3b-nativa-nacion`,
`F2-4-dedupe-importacion`, `F2-5-alta-medio-desde-resumen`, `F2-6-sugerencia-categoria`,
`F2-7-visor-comprobantes`, `F2-8-comprobante-origen-destino`,
`F2-9-medio-transferencia-desde-comprobante`, `F2-10-reportes-dedup-persona-por-miembro`,
`F2-11-transferencia-por-persona`, `F2-12-parser-transferencias-universal`.

**Pendiente:** **F2-13** (aviso de duplicado al dar de alta).

### Decisiones de la charla (2026-06-23) que fijan estos tickets

- **Transferencias:** no traen datos de tarjeta → el medio es `type='bank_account'` (sin red/last4).
  La persona se atribuye **según el tipo**: gasto → cuenta de **origen** (quien envía), ingreso →
  cuenta de **destino** (quien recibe).
- **Auto-asignar:** si el titular del lado dueño coincide con un miembro, se **preasigna `owner_member_id`**
  (editable), no solo candidato.
- **Dedup de persona:** reportes agrupan por **`owner_member_id`**; el nombre escrito distinto por cada
  banco deja de duplicar. El match por nombre ya es **order-independent** (token-set en `account-match`).

### Decisiones de la 2ª charla (2026-06-23) — revisan el modelo de F2-9

- **Un medio `'transfer'` por persona** (no por persona+banco): la precarga detecta el titular del lado
  dueño, lo matchea a un miembro y selecciona/crea (lazy) **su** medio "Transferencia". Esto **revisa** la
  decisión de arriba (`type='bank_account'` por persona+banco) → ver **F2-11**. El `account_type` suma el
  valor `'transfer'` para que se catalogue como tal.
- **Banco en el movimiento, no en el medio:** como una persona transfiere desde varios bancos, el banco va
  a una columna nueva `transactions.bank` (opcional, precargada del OCR) → **F2-11**.
- **Parser universal, "mejor no cargar que cargar mal":** ante la duda, vacío y carga manual; nunca un
  valor inventado. Estrategia **híbrida** regex-por-proveedor + fallback **LLM/visión** (el LLM suma dep/
  costo/key → decisión de Opus, corre en el micro) → **F2-12**.
- Los **dos bugs de F2-9** (forms anidados que recargaban y perdían el comprobante; medio existente no
  auto-detectado en transferencias sin banco) se arreglaron en el PR de F2-9 (#24).

## Alcance (PRD §14 — Fase 2: semanas 7–11)

Microservicio Python para OCR/parseo (Opción C de §9.2), conversión multi-moneda con API de FX,
y la ingesta inteligente de comprobantes y resúmenes de tarjeta.

## Tickets previstos

| ID tentativo | Título | FR | Depende de |
|---|---|---|---|
| `F2-1` | Microservicio Python de ingesta (scaffold + deploy + contrato con la web) | infra Fase 2 | Fase 1 cerrada |
| `F2-2` | OCR de comprobantes: extraer monto/fecha/comercio y precargar el alta | **FR-14** | F2-1, B8 |
| `F2-3` | Parseo de resúmenes (Banco Nación y Patagonia, Visa/Mastercard) → staging de movimientos | **FR-16** | F2-1, B8 |
| `F2-4` | Detección de duplicados al importar (monto+fecha+comercio) | **FR-17** | F2-3 |
| `F2-5` | Alta de tarjeta/medio desde el resumen: detectar el medio y, si no existe, ofrecer crearlo desde el staging | **FR-16b** | F2-3, B7 |
| `F2-6` | Sugerencia automática de categoría según descripción/comercio | **FR-19** | F2-3, B6 |
| `F2-7` | Visor de comprobantes: ver/descargar el adjunto (imagen/PDF) de un movimiento vía signed URL | **FR-10/FR-13** | B8 |

## Notas de diseño a resolver al planificar (no decididas)

- **Identificación del medio (FR-16b):** apoyarse en banco + red + **últimos 4 dígitos** + titular. El parser
  debe extraer los últimos 4 y el alta autocompletarlos. Definir el criterio de *match* contra medios existentes.
- **Extensiones:** un resumen puede mezclar movimientos de la titular y de sus extensiones; el alta automática
  debe contemplar crear cada extensión como medio propio (FR-6c).
- **Dónde corre el OCR/parseo:** microservicio Python desacoplado (PRD §9.2 Opción C, §9.3), no en el front.
- **Resúmenes de tarjeta cifrados/con password (F2-3):** los PDF de resumen suelen venir **protegidos con
  contraseña** (en bancos AR, típicamente el DNI del titular o una variante). El flujo de subida debe **pedir la
  contraseña** para poder abrir/parsear el PDF, descifrarlo en memoria en el microservicio Python y **no
  persistir la contraseña** en ningún lado. Definir UX (campo password en el upload, reintento si falla el
  desbloqueo) y manejo de error → `attachment_status = 'failed'`.
- **Visor de comprobantes (F2-7):** la "plomería" ya existe desde B8 (`getAttachmentUrl` genera signed URLs del
  bucket privado). Falta solo la UI (`<img>` para imágenes, link "Ver/Descargar" para PDF). No depende del
  microservicio Python, así que **podría adelantarse a Fase 1** (p. ej. sumarlo a B10) si se quiere cerrar el
  ciclo de FR-10/FR-13 antes.
