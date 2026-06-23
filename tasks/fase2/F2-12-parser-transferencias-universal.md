# F2-12 Parsing universal de comprobantes de transferencia (regex por proveedor + fallback LLM)

**Sprint:** Fase 2 · **Modelo sugerido:** Opus (decisión de dependencia/costo del LLM) + Sonnet (regex) · **Depende de:** F2-2, F2-8

## Objetivo
Que la extracción de comprobantes de transferencia funcione entre **bancos y billeteras** (Naranja X, Ualá, Mercado Pago, BNA, Patagonia, etc.), no solo con el formato de etiquetas `Origen:/Destino:/Importe:` actual. **Principio rector (decisión 2026-06-23): "mejor NO cargar un dato que cargarlo mal".** Alta precisión: ante la duda, devolver vacío y dejar la carga manual, nunca inventar.

## Contexto
- Parser actual: `services/ingesta/app/parsing/receipts.py` — heurística por **etiquetas** (`_ORIGIN_LABEL`, `_DEST_LABEL`, `_BANK_LABEL`, `_AMOUNT_LABEL`). Cada proveedor rotula distinto y muchas billeteras son imágenes con layout libre → falla.
- **Bug concreto reportado:** comprobante de Mercado Pago → monto extraído `2026` (el **año**) en una transferencia de **1 peso**. Causa: sin etiqueta "Importe/Monto", `extract_amount` cae a `max(plain)` (enteros sueltos) y pesca el año/identificador. Esto viola el principio rector.
- Estrategia decidida: **híbrida** — regex/heurística por proveedor primero; si la confianza es baja o falta un campo clave, **fallback a extracción por LLM/visión**.
- Política de modelos/portabilidad (CLAUDE.md): el LLM suma **dependencia + costo + API key** → decisión de Opus. Debe correr en el **micro Python** (cascarón fino: cliente del modelo en el borde, lógica pura testeable al lado), no en el front. Respetar hosting sin tarjeta para la infra.

## Fase A — Endurecer + regex por proveedor (gratis, sin deps; sale primero)
- **Monto conservador (mata el bug del 2026):** en transferencias, **no** caer a `max(plain)` de enteros sueltos. Exigir etiqueta de importe **o** parte decimal (centavos); excluir tokens que parezcan **año/fecha** (`19xx/20xx`, fechas DMY/ISO) e identificadores. Si no hay candidato confiable → `amount=None` (no inventar).
- **Vocabulario de etiquetas por proveedor:** ampliar sinónimos (MP: "Le transferiste a", "Dinero enviado", "Transferiste"; Ualá; Naranja; BNA homebanking; etc.) para origen/destino/banco/importe.
- **Detección por proveedor** (como `parsing/patagonia.py` / `parsing/nativa_nacion.py` para resúmenes): identificar el emisor por marcas del texto y enrutar a reglas específicas cuando aporten precisión.
- **Confianza honesta:** si los campos no se reconocen con seguridad, bajar `confidence` y devolver vacío en vez de un valor dudoso (el front ya avisa con baja confianza; preferimos campo vacío).

## Fase B — Fallback LLM/visión (la mitad "híbrida")
- Cuando la Fase A devuelve baja confianza o le falta un campo clave, llamar a un modelo (Claude con visión sobre la imagen del comprobante) para extraer el JSON del contrato (`ReceiptExtraction`).
- Cliente del modelo en el **borde** (`app/ocr.py` o un `app/llm.py`), key por env; el prompt/validación de salida en un módulo testeable. Validar y **no confiar a ciegas**: si el LLM no está seguro, vacío (mismo principio rector).
- Definir y escalar: proveedor/modelo, costo por comprobante, manejo de errores/timeout, y que la ausencia de key **degrade** a solo Fase A (no rompa).

## Samples / fixtures
- El usuario aporta comprobantes reales (Naranja, Ualá, MP, BNA, Patagonia, …) en `samples/resumenes-privados/` (git-ignored, privados).
- Por cada proveedor, agregar un **fixture de texto anonimizado** en `services/ingesta/tests/fixtures/` y su caso en `tests/test_receipts_parsing.py` (montos, fechas, origen/destino/banco esperados; y casos donde lo correcto es **vacío**).

## Follow-up (reportado 2026-06-23, post F2-11): orden de nombre en `holder`
Al cargar un comprobante de transferencia con un titular que **no** matchea a un miembro, F2-11
crea el medio `'transfer'` con `holder_name` = `origin_holder`/`dest_holder` tal cual lo extrae
`receipts.py` — y ese texto puede venir en **cualquier orden** (`Apellido Nombre` o `Nombre
Apellido`) según el banco/billetera del comprobante. `accountLabel` (`features/accounts/format.ts`)
muestra las primeras 5 letras del primer token, así que si el comprobante trae "Apellido Nombre"
el combo de medios termina mostrando el apellido (poco útil en un workspace familiar, donde el
apellido suele ser compartido). Decisión (2026-06-23): **no** tocarlo ahora vía heurística (mostrar
el último token rompería los casos donde sí viene "Nombre Apellido"); evaluarlo en este ticket
junto con la extracción real por proveedor, donde se puede saber el orden con más certeza.

## Criterios de aceptación
- [ ] El comprobante de MP de 1 peso ya **no** carga `2026` como monto (carga 1 o, si no hay certeza, nada).
- [ ] Para cada proveedor con sample, la extracción acierta los campos presentes **o** devuelve vacío (nunca un valor inventado).
- [ ] Sin API key del LLM, el micro sigue funcionando con la Fase A (degradación, no error).
- [ ] Tests del parser (pytest) cubren cada proveedor agregado, incluidos los casos "preferir vacío".
- [ ] Lógica de extracción pura y testeable; el cliente del LLM aislado en el borde.

## Fuera de alcance
- Modelo de medios/persona de la transferencia (F2-11).
- Parseo de resúmenes de tarjeta (F2-3/F2-3b, ya hechos).

## Por qué este modelo
La Fase A es regex/heurística acotada (Sonnet) y entrega valor gratis ya. La Fase B introduce **dependencia + costo + key** → **Opus decide** proveedor/modelo y la frontera de portabilidad antes de sumarla.
