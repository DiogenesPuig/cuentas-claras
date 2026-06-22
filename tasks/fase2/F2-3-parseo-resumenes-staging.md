# F2-3 Parseo de resúmenes → revisión + confirmación en bloque

**Sprint:** Fase 2 · **Modelo sugerido:** Opus (contrato + decisiones, ya planificado) → Sonnet (ejecuta) · **Depende de:** F2-1 ✅, F2-0 ✅, B8

## Objetivo
Subir un resumen de tarjeta (PDF), parsearlo en el microservicio Python y mostrar sus movimientos en una pantalla de **revisión** para que el usuario edite/descarte y **confirme todo en bloque**, creando los movimientos reales. Bancos objetivo iniciales: **Patagonia (Visa/Master) y Visa de Nación** (layouts tabulares).

## Contexto (links a docs)
- PRD §5.4 FR-16 (parseo con staging) y §9.4 (FX por `charged_on`). `tasks/fase2/PLAN.md` §2/§4.
- Ya existe: subida a `attachments` (`kind='statement'`), `transactions.source='statement_import'`, `charged_on`, y las columnas de cuotas `installment_n`/`installment_total` (F2-0, ya en prod).
- El micro (F2-1) expone `POST /v1/statements:parse` (hoy stub) y `src/lib/ingesta.ts` tiene `parseStatement`.
- **Referencia local privada:** `samples/resumenes-privados/` (gitignored) tiene resúmenes reales para construir/probar parsers a mano. Los **tests** corren contra fixtures **anonimizados/sintéticos** versionables, no contra los privados.
- **Seguridad:** el PDF es input no confiable → parser defensivo, límites de tamaño/tiempo (ya en F2-1), sin ejecutar contenido embebido.

## Hallazgos de formato (muestras privadas, 2026-06)
- **Dos familias de layout:**
  - *Patagonia (Visa/Master) y Visa de Nación:* tabular, parseable por línea. Fila ≈ `FECHA(dd.mm.aa)  COMPROBANTE(6díg+sufijo)  DETALLE  [Cuota NN/NN]  IMPORTE(1.234,56)`. Encabezado por tarjeta: `Tarjeta NNNN Total Consumos de <NOMBRE>` → de ahí salen **últimos 4 + titular**. → **alcance de F2-3.**
  - *Nativa Internacional (Nación, Mastercard):* sin estructura de columnas (extracción por líneas dio **0 filas**) → requiere `pdfplumber` por **coordenadas/tablas**. → **diferido a F2-3b.**
- **Cuotas presentes** (`Cuota 02/03`) → se mapean a `installment_n`/`installment_total` (F2-0).
- **Multi-tarjeta por resumen:** un PDF agrupa titular + adicionales, cada uno con su last4/holder → el parser **agrupa filas por tarjeta**.
- **Multimoneda:** secciones `$` y `U$S` → capturar **moneda por fila**.
- **Signo:** importes con sufijo `-` = pagos/devoluciones (no son gastos).

## DECISIONES (resueltas en planificación 2026-06-22)
- **Staging EFÍMERO en el front (no hay tabla `statement_staging`, no hay migración).** Flujo: subir PDF → parsear → revisar todas las filas en pantalla (editar/destildar) → **un solo botón de confirmar** crea los movimientos en bloque. Las filas viven en el estado de React hasta confirmar. _Trade-off aceptado: recargar antes de confirmar pierde lo parseado → se vuelve a subir el PDF (parseo barato)._
- **Alcance de parsers: tabular primero.** Patagonia Visa/Master + Visa Nación (un parser por plantilla + un dispatcher que elige por marcadores del texto). Nativa-Nación (coordenadas) → **F2-3b** (ticket de seguimiento).
- **Contrato `/v1/statements:parse` (revisado, multi-tarjeta):**
  ```
  POST /v1/statements:parse  (multipart: file, password?)
  → {
    "statement_close_on": "YYYY-MM-DD" | null,   // imputación del resumen → charged_on
    "cards": [
      {
        "account_hint": { "bank", "network", "last4", "holder" },
        "rows": [
          { "occurred_on": "YYYY-MM-DD", "description": str, "amount": number,
            "currency": "ARS" | "USD", "installment": {"n":int,"total":int} | null,
            "kind": "charge" | "payment" }
        ]
      }
    ]
  }
  ```
  Reemplaza el stub de F2-1 (`account_hint` único + `rows` plano). Hay que actualizar `app/schemas.py` y los tipos de `src/lib/ingesta.ts`.
- **Pagos/devoluciones (`kind='payment'`):** se muestran en la revisión pero **destildados por defecto** (son pagos de la tarjeta, no gastos); el usuario decide si los importa.
- **Moneda por fila:** se respeta (`ARS`/`USD`). La conversión a base la sigue resolviendo el pipeline de reportes (C13) por `charged_on`; F2-3 no calcula FX.
- **`charged_on`:** se setea en todos los movimientos importados con `statement_close_on` (imputación del resumen); `occurred_on` = fecha de consumo de la fila. Si el parser no detecta el cierre, el form de subida lo pide.
- **Medio (`account_id`):** en F2-3 el usuario elige un medio existente por tarjeta desde un combo (la detección/creación automática por last4+titular es **F2-5**). La pantalla ya muestra el `account_hint` para que F2-5 se enganche.
- **Password del PDF:** se pide en el upload y se manda en el multipart; el micro descifra **en memoria** (pdfplumber soporta password) y **nunca la persiste ni la loguea**. Clave incorrecta → parse falla → `attachment_status='failed'` + mensaje de reintento.
- **Fixtures (privacidad):** los parsers son funciones puras sobre el **texto extraído**. Los tests corren contra fixtures de **texto anonimizado** en `services/ingesta/tests/fixtures/` (nombres→sintéticos, last4→`0000`, CBU/importes→valores ficticios), derivados a mano de las muestras privadas. No se versiona ningún PDF real.

## Archivos a crear/editar
- **Micro:** `app/schemas.py` (contrato revisado), `app/parsing/statements.py` (dispatcher por plantilla), `app/parsing/patagonia.py` y `app/parsing/visa_nacion.py` (parsers puros por línea), `app/routes/statements.py` (usar el contrato real), `tests/fixtures/*.txt` + `tests/test_statements_parsing.py`.
- **Web:** `src/lib/ingesta.ts` (tipos del contrato nuevo). Nueva feature `src/features/imports/`: `api.ts` (subir attachment `kind='statement'`, llamar al micro, crear `transactions` en bloque), `hooks.ts`, `schema.ts`, `components/StatementImport.tsx` (upload + password), `components/StagingTable.tsx` / `StagingRow.tsx` (revisión); ruta `/importar` en el router + link en el layout.
- READMEs de las carpetas tocadas.

## Pasos
1. Upload del PDF (+ password opcional) → `attachments` (`kind='statement'`).
2. Llamar `POST /v1/statements:parse`; el micro devuelve `{ statement_close_on, cards[] }`. Si falla desbloqueo/parseo → `attachment_status='failed'` + mensaje claro.
3. Mostrar las filas agrupadas por tarjeta en la pantalla de revisión (estado del front): editar monto/fecha/descripción, asignar categoría y medio, destildar las que no van (pagos destildados por defecto).
4. Confirmar → crear `transactions` en bloque (`source='statement_import'`, `charged_on=statement_close_on`, `installment_n/total`, `attachment_id`) bajo RLS del usuario; marcar `attachment_status='processed'`.

## Criterios de aceptación
- [ ] Subir un PDF de Patagonia/Visa-Nación parsea filas con monto/fecha/descripción/cuotas correctos (fixtures), agrupadas por tarjeta.
- [ ] El usuario edita/destilda y confirma en bloque; se crean los movimientos (`source='statement_import'`).
- [ ] Pagos/devoluciones llegan destildados por defecto.
- [ ] PDF con password: desbloquea con la clave correcta; clave incorrecta → `failed` sin persistir la clave.
- [ ] Toda la escritura respeta RLS por workspace.
- [ ] Lógica pura de parseo testeada con fixtures anonimizados; `typecheck`/`lint`/`test`/`pytest`/`ruff` ok.

## Fuera de alcance
- **Nativa-Nación (Mastercard) por coordenadas → F2-3b.**
- Dedupe (F2-4), alta/match de medio desde el resumen (F2-5), sugerencia de categoría (F2-6): se enganchan en esta pantalla pero se especifican aparte.
- FX: lo resuelve C13 por `charged_on`.

## Tests
- `pytest` de los parsers por banco con **fixtures de texto anonimizado**. Web: flujo subir→revisar→confirmar con el micro/api mockeados.

## Por qué este modelo
Opus dejó resueltos contrato, alcance y decisiones (impactan F2-4/5/6); Sonnet implementa parsers + UI con eso fijo.
