# F2-8 Comprobante de transferencia: extraer origen y destino

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-2

## Objetivo
Que el microservicio de ingesta, al procesar un **comprobante de transferencia**, devuelva además del monto/fecha/comercio el **titular y banco de origen** y el **titular y banco de destino**. Es el insumo para que el front (F2-9) cree/asigne el medio correcto y lo atribuya a la persona según el tipo (gasto→origen, ingreso→destino). **Solo toca el microservicio (lógica pura + contrato); no cambia el front todavía.**

## Contexto (links a docs)
- `services/ingesta/app/parsing/receipts.py` ya detecta el subtipo `transfer` (vs `purchase`) y extrae la contraparte con `extract_merchant` (hoy saca **destino**: `_DESTINO_RE` = `destino|para|titular|beneficiario`). No extrae el **origen** ni los bancos.
- `services/ingesta/app/schemas.py` → `ReceiptExtraction` (hoy: `amount`, `currency`, `date`, `merchant`, `confidence`).
- CLAUDE.md: la lógica pura de las edge/micro functions va en módulos sin IO (acá `parsing/receipts.py`), testeable con fixtures de **texto anonimizado** (nunca PDFs reales con datos personales).
- Frontera de portabilidad: el contrato HTTP lo consume `lib/ingesta` desde el front; mantener el cambio retrocompatible (campos nuevos opcionales).

## Archivos a crear/editar
- `services/ingesta/app/schemas.py` → extender `ReceiptExtraction` con campos opcionales: `origin_holder`, `origin_bank`, `dest_holder`, `dest_bank` (todos `str | None`, default `None`). `merchant` se mantiene por compatibilidad (= `dest_holder` en transferencias).
- `services/ingesta/app/parsing/receipts.py` → funciones puras nuevas para origen/destino y banco (regex clave-valor: `Origen|De|Ordenante|Titular origen` para origen; `Destino|Para|Beneficiario` para destino; `Banco`/nombre de entidad para cada lado). Poblar los campos solo en subtipo `transfer`.
- `services/ingesta/app/main.py` (o donde se arma la respuesta) → mapear los campos nuevos.
- `services/ingesta/tests/` → fixture(s) de comprobante de transferencia anonimizado + tests de extracción origen/destino/banco.
- README de `services/ingesta/` si lista los campos del contrato.

## Pasos
1. Definir, sobre 1–2 muestras reales (en `samples/resumenes-privados/`, **gitignored**), qué etiquetas usan los comprobantes para origen/destino/banco. Volcar lo aprendido a un **fixture anonimizado**.
2. Funciones puras `extract_origin(text)` / `extract_dest(text)` (titular) y `extract_bank(text, side)`; tolerar orden de nombre y ausencia (devuelven `None`).
3. Extender `ReceiptExtraction` (campos opcionales) y poblarlos solo en `transfer`. En `purchase` quedan `None`.
4. Subir la confianza solo si se reconoció al menos origen+monto (criterio conservador).

## Criterios de aceptación
- [x] Para un comprobante de transferencia, la respuesta trae `origin_holder`/`origin_bank` y `dest_holder`/`dest_bank` cuando están en el texto.
- [x] Para una compra (`purchase`), esos campos van `None` y `merchant` sigue como hoy.
- [x] El cambio es **retrocompatible**: clientes viejos que solo leen `amount/currency/date/merchant` no se rompen.
- [x] Tests con fixture anonimizado cubren: orden de nombre invertido, comprobante sin banco, y compra (campos nulos).
- [x] `pytest` y `ruff` ok; ningún PDF/dato personal commiteado.

## Fuera de alcance
- Crear/asignar el medio o atribuir la persona en el front (eso es **F2-9**).
- Matchear el titular contra los miembros del workspace (F2-9).

## Tests
- `services/ingesta/tests/test_receipts*.py`: origen/destino/banco desde fixture; nombre invertido; ausencia; `purchase` con nulos; retrocompatibilidad del schema.

## Por qué este modelo
Sonnet: extensión acotada de un parser existente con contrato claro; sin decisiones de arquitectura (ya resueltas en la planificación).
