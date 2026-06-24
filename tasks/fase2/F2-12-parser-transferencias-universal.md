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

## Plan de ejecución Fase A (afinado 2026-06-24 — listo para Sonnet)

La Fase A se divide en dos partes con dependencias distintas:

### A.1 — Endurecer el monto (NO depende de muestras) ✅ HECHO (2026-06-24, rama task/f2-12)
Mata el bug del 2026. Todo en `services/ingesta/app/parsing/receipts.py`, sin tocar el contrato.
- **`extract_amount`: eliminada la caída final a `max(plain)`.** La cascada quedó `keyed →
  with_cents → None`: si no hubo etiqueta de importe **ni** ningún token con centavos, devuelve
  `None` (preferir vacío a inventar). Un monto **etiquetado** sin centavos (ej. `$2000` redondo)
  **sí** se carga: la etiqueta alcanza como señal confiable.
- **`_money_tokens` + nuevo `_date_spans`: se excluyen los dígitos que son parte de una fecha**
  (DMY/ISO) de la misma línea, para que el año (`2026` de `05/06/2026`) no gane como monto en una
  línea etiquetada. Decisión (2026-06-24): NO se descartan a ciegas los enteros 19xx/20xx —eso
  tiraría montos redondos legítimos—; el descarte es solo de dígitos contenidos en una fecha.
- **Tests:** `test_transfer_billetera_sin_etiqueta_no_carga_anio` (MP de 1 peso → `None`),
  `test_amount_ignora_anio_de_fecha_en_linea_etiquetada`, `test_amount_etiquetado_entero_sin_centavos_se_respeta`,
  `test_amount_sin_etiqueta_ni_centavos_da_none`. Suite del micro verde (52 passed).

### A.2 — Vocabulario genérico + fechas en español ✅ HECHO (2026-06-24, enfoque genérico)
Decisión 2026-06-24: enfoque **genérico** (ampliar vocabulario, sin módulo por proveedor). El
orden del nombre y los quirks finos quedan para una fase por proveedor / Fase B. Verificado con
OCR **real** de las 5 muestras (Naranja X, Mercado Pago, BNA, Ualá, Patagonia).
- **Montos:** `_AMOUNT_LABEL` suma `enviaste|recibiste|transferiste`; `extract_amount` ahora toma
  la etiqueta **en línea propia** con el monto en la línea siguiente (recibos mobile). Naranja X
  (`Enviaste $35.000`, sin centavos) carga 35000; BNA (`Monto`/`$1.652,44`) carga 1652.44; Ualá
  (`Monto debitado $1,00`) carga 1. MP (`$1` sin etiqueta) → `None` (principio rector).
- **Fechas en español:** `extract_date` reconoce mes abreviado (`22/JUN/2026`) y textual
  (`23 de junio de 2026`) además de ISO/DMY numérica (`_DATE_MONTH_SLASH`/`_DATE_MONTH_DE` + mapa
  `_MONTHS`). Cubre Naranja X y MP, que antes quedaban sin fecha.
- **Origen/destino:** `_ORIGIN_LABEL`/`_DEST_LABEL` suman `cuenta origen/destino`, `destinatario`,
  `remitente`/`nombre`, con tolerancia al bullet del OCR (`o De`/`o Para` de MP). Nuevo guard en
  `_extract_party` (`_FIELD_LABEL`): si tras una etiqueta sola viene OTRO campo (Concepto, CBU…),
  devuelve `None` en vez de cargarlo mal — **bug encontrado en la verificación real** (Ualá daba
  `origin='Concepto VAR'`).
- **Tests:** fixtures anonimizados inline (convención del archivo, no `tests/fixtures/`) por
  proveedor en `test_receipts_parsing.py` + tests de fecha y del guard. Suite verde (57 passed).

**Imperfecciones conocidas (deferidas a fase por proveedor / Fase B), no son cargas erróneas:**
- Naranja X arrastra el prefijo del logo (`NX <nombre>`) en el titular origen.
- Orden del nombre: Patagonia trae `APELLIDO, NOMBRE`; el resto `Nombre Apellido` (ver Follow-up).
- Banco de billeteras (Naranja/MP/Ualá) no se captura (nombres libres, sin etiqueta `Banco:`).

## Criterios de aceptación
- [x] El comprobante de MP de 1 peso ya **no** carga `2026` como monto (queda en `None` → carga manual). *(A.1)*
- [x] Para cada proveedor con sample, la extracción acierta los campos presentes **o** devuelve vacío (nunca un valor inventado). *(A.2, verificado con OCR real de los 5 proveedores)*
- [x] Tests del parser (pytest) cubren cada proveedor agregado, incluidos los casos "preferir vacío". *(A.2)*
- [~] Lógica de extracción pura y testeable. *(hecho; el cliente del LLM aislado en el borde corresponde a Fase B)*
- [ ] Sin API key del LLM, el micro sigue funcionando con la Fase A (degradación, no error). *(Fase B pendiente; hoy NO hay dependencia de LLM, así que el micro ya corre 100% con Fase A)*

## Fuera de alcance
- Modelo de medios/persona de la transferencia (F2-11).
- Parseo de resúmenes de tarjeta (F2-3/F2-3b, ya hechos).

## Por qué este modelo
La Fase A es regex/heurística acotada (Sonnet) y entrega valor gratis ya. La Fase B introduce **dependencia + costo + key** → **Opus decide** proveedor/modelo y la frontera de portabilidad antes de sumarla.
