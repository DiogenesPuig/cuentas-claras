# Backlog — Fase 2 (Ingesta inteligente)

> **Planificada (2026-06-22).** Fase 1 está cerrada. El plan de arquitectura y decisiones está en
> `PLAN.md`. La mayoría depende del microservicio Python (`F2-1`); `F2-7` no necesita infra nueva.
>
> **Estado (2026-06-23):** ✅ F2-0, F2-1, F2-2 (PR #18); ✅ F2-3 (Patagonia tabular, + reintegros como
> gasto negativo), ✅ F2-3b (Nativa-Nación) y ✅ F2-4 (dedupe al importar). **Pendientes: F2-5, F2-6, F2-7.**
> Los tickets completados se movieron a `tasks/done/` (ver allí su estado/criterios).

## Archivos de esta carpeta

- `PLAN.md` — plan de Fase 2: arquitectura, decisiones (resueltas y pendientes), desglose y orden.
- `F2-5-alta-medio-desde-resumen.md` — identificar/crear el medio desde el resumen (FR-16b).
- `F2-6-sugerencia-categoria.md` — sugerencia automática de categoría (FR-19).
- `F2-7-visor-comprobantes.md` — visor/descarga de adjuntos (FR-10/FR-13), sin infra nueva.

Completados (en `tasks/done/`): `F2-0-modelar-cuotas`, `F2-1-microservicio-python`,
`F2-2-ocr-comprobantes`, `F2-3-parseo-resumenes-staging`, `F2-3b-nativa-nacion`,
`F2-4-dedupe-importacion`.

**Orden recomendado restante:** {F2-5, F2-6} (dependen de F2-3, ya hecho) y F2-7 (independiente).

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
