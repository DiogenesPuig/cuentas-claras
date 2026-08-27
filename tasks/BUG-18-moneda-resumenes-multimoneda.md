# BUG-18 Resúmenes multi-moneda: todos los consumos quedan en ARS

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet (con casos de prueba reales) · **Depende de:** —

## Objetivo
Cuando un resumen de tarjeta tiene consumos en varias monedas (columnas PESOS/DOLARES), cada
fila importada debe quedar con su **moneda real** (`ARS`/`USD`), no forzada a `ARS`.

## Contexto
- Reportado por el usuario (2026-08-03) probando la carga de un resumen con consumos en ambas
  monedas: todo terminó cargado como ARS.
- Confirmado en código: `services/ingesta/app/parsing/patagonia.py:123` y
  `services/ingesta/app/parsing/nativa_nacion.py:155` fuerzan `currency="ARS"` en `_parse_row`
  sin mirar la fila.
- Los encabezados de detalle sí anuncian dos columnas de importe: `"...PESOS DOLARES"`
  (Patagonia, `tests/fixtures/patagonia_tabular.txt:7`) y `"...NRO CUPON PESOS DOLAR"`
  (Nativa-Nación/BNA, `tests/fixtures/nativa_nacion.txt:24`,
  `tests/fixtures/bna_mastercard.txt:23`).
- El ticket original `tasks/done/F2-3-parseo-resumenes-staging.md:21,46` preveía
  **"moneda por fila"**, pero los parsers concretos (Patagonia, y F2-3b Nativa-Nación) no
  llegaron a implementarlo — quedó como deuda, no como decisión.
- Ya existe una heurística de moneda por símbolos para **comprobantes sueltos**
  (`extract_currency` en `services/ingesta/app/parsing/receipts.py:186`, busca `U$S`/`USD`/`$`
  en el texto), pero **no aplica directo acá**: los resúmenes tabulares no repiten el símbolo en
  cada fila, tienen dos columnas numéricas (PESOS | DOLARES) y cada fila cae en una u otra.
- **Ninguno de los fixtures actuales** (`patagonia_tabular.txt`, `nativa_nacion.txt`,
  `bna_mastercard.txt`) tiene una fila real con importe en la columna DOLARES — todas las filas
  de ejemplo son en pesos. No se puede escribir a ciegas el regex de dos columnas sin ver cómo
  queda el texto extraído (pdfplumber) de una fila real en dólares (¿la columna pesos queda
  vacía / en "0,00" / no aparece el token? ¿cuántos espacios separan las columnas?).

## Pasos
1. Conseguir del usuario texto real (**anonimizado**, sin datos de tarjeta/titular) de al menos
   una fila en dólares de un resumen Patagonia y uno Nativa-Nación/BNA, extraído tal cual sale
   de pdfplumber (no reescrito a mano) — mismo enfoque que `BUG-10`/`F2-14`.
2. Agregar esos casos como fixtures/tests en `services/ingesta/tests/` (fixture con una fila en
   ARS y otra en USD en el mismo resumen).
3. Ajustar `_parse_row` en `patagonia.py` y `nativa_nacion.py` para detectar de qué columna sale
   el importe (o extraer ambos importes de la fila y quedarse con el no-nulo) y asignar
   `currency` en consecuencia, en vez de `"ARS"` fijo.
4. Verificar que las filas sin dólares (la mayoría de los fixtures actuales) siguen dando
   `ARS` — sin regresión.
5. Confirmar que el front no necesita cambios: `src/features/imports/staging.ts:95` ya hace
   `currency: row.currency ?? 'ARS'`; alcanza con que el backend mande el valor correcto por fila.

## Criterios de aceptación
- [ ] Una fila en dólares de un resumen Patagonia real (anonimizado) queda con `currency="USD"`.
- [ ] Una fila en dólares de un resumen Nativa-Nación/BNA real (anonimizado) queda con
      `currency="USD"`.
- [ ] Las filas en pesos de los fixtures existentes siguen dando `currency="ARS"`.
- [ ] Tests con los casos reales en `services/ingesta/tests/`.
- [ ] El micro de ingesta queda **redeployado al Space de Hugging Face** (el fix vive en
      `services/ingesta`, no en el repo del front — no alcanza con mergear, según
      `CLAUDE.md` paso 9).

## Fuera de alcance
- Front (`staging.ts`) — ya soporta `currency` por fila, no requiere cambios.
- Otros bancos/formatos no cubiertos hoy.
- Conversión/FX entre monedas (la resuelve el pipeline de reportes, C13, por `charged_on`).

## Tests
`services/ingesta/tests/test_patagonia_parsing.py` / `test_nativa_nacion_parsing.py` (o los que
correspondan) con fixtures que incluyan filas en ambas monedas.

## Por qué este modelo
Sonnet, con casos de prueba reales — como `BUG-10`, no arranca sin el texto real (anonimizado)
de al menos una fila en dólares; sin eso se corre el riesgo de adivinar mal el layout de la
columna DOLARES.
