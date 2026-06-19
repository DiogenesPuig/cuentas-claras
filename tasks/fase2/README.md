# Backlog — Fase 2 (Ingesta inteligente)

> **Parking lot.** Estos tickets **no se trabajan todavía**: dependen de que Fase 1 (MVP) esté cerrada
> y de levantar el microservicio Python de ingesta. Se listan acá para no perder el alcance ya decidido
> en el PRD (§14 Roadmap, §5.4 Ingesta). Cuando se arranque Fase 2, cada ítem se convierte en un archivo
> de ticket propio siguiendo la plantilla de `tasks/README.md`.

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

## Notas de diseño a resolver al planificar (no decididas)

- **Identificación del medio (FR-16b):** apoyarse en banco + red + **últimos 4 dígitos** + titular. El parser
  debe extraer los últimos 4 y el alta autocompletarlos. Definir el criterio de *match* contra medios existentes.
- **Extensiones:** un resumen puede mezclar movimientos de la titular y de sus extensiones; el alta automática
  debe contemplar crear cada extensión como medio propio (FR-6c).
- **Dónde corre el OCR/parseo:** microservicio Python desacoplado (PRD §9.2 Opción C, §9.3), no en el front.
