# services/ — Microservicios fuera del bundle del front

Servicios desacoplados del front y de Supabase (PRD §9.2 Opción C). Se deployan
aparte (host con Docker, no Supabase) y la web los consume vía HTTP a través de un
único módulo (`src/lib/ingesta.ts`).

- `ingesta/` — microservicio Python (FastAPI) de OCR de comprobantes y parseo de
  resúmenes de tarjeta (Fase 2). Stateless, no toca la DB.
