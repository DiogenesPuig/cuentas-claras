# F2-3b Parser de Nativa-Nación (Mastercard) por coordenadas

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-3 ✅

## Objetivo
Sumar al dispatcher de resúmenes (F2-3) un parser para el layout **Nativa Internacional
(Banco Nación, Mastercard)**.

> **Corrección al planificar (2026-06-23):** la premisa de "0 filas en texto plano" era
> errónea. Al inspeccionar el PDF real con `pdfplumber`, `extract_text()` devuelve el
> detalle completo (en la página del "RESUMEN CONSOLIDADO"). **No hizo falta parseo por
> coordenadas:** se hizo un parser sobre texto, como el de Patagonia, encajándolo en el
> dispatcher existente (que ya opera sobre texto) sin tocar el borde de IO (`pdf.py`).

## Contexto
- F2-3 ya dejó: contrato `{ statement_close_on, cards[] }`, `app/pdf.py` (bytes→texto),
  el dispatcher `app/parsing/statements.py` y el parser tabular `app/parsing/patagonia.py`.
  Acá se agrega `app/parsing/nativa_nacion.py` + su rama en el dispatcher.
- Muestra real privada: `samples/resumenes-privados/NATIVA_INTERNACIONAL_MC11-F_VTO_03-Jun-26_*.pdf`.
- `tasks/fase2/F2-3-parseo-resumenes-staging.md` → "Hallazgos de formato".

## Pasos
1. Inspeccionar el PDF con `pdfplumber` (`extract_tables`/`extract_words` + `bbox`) para
   reconstruir filas por posición de columnas (fecha, comprobante, detalle, cuota, importe).
2. Implementar `app/parsing/nativa_nacion.py` (PURO sobre el objeto de página o sobre una
   estructura intermedia ya extraída, para poder testear sin el PDF) que devuelva `StatementParse`.
3. Detección en el dispatcher (`matches`): marcadores propios de Nativa/Nación.
4. Fixtures anonimizados (estructura de palabras/posiciones o tabla sintética) + `pytest`.

## Criterios de aceptación
- [x] Un resumen Nativa-Nación genera filas con monto/fecha/descripción/cuotas correctos, agrupadas por tarjeta.
- [x] El dispatcher elige el parser correcto sin romper el tabular de Patagonia.
- [x] Lógica de parseo testeada con fixtures anonimizados; `pytest`/`ruff` ok.

## Estado
Hecho (2026-06-23). `app/parsing/nativa_nacion.py` + rama en el dispatcher. Validado contra el
PDF real privado: 2 tarjetas (titular `PUIG LUCAS…` y adicional `PUIG HERMES…`), cierre
2026-05-21, cuotas y comprobantes OK; los totales por tarjeta reconcilian con los `TOTAL
TITULAR`/`TOTAL ADICIONAL` del resumen (42.486,50 y 135.178,20). Detalles del layout: importes
**sin separador de miles** (`24570,00`), fecha `dd-Mon-aa`, agrupación por `TOTAL TITULAR`/`ADICIONAL`,
`last4=None` (el PAN no está en el texto). Fixture anonimizado `tests/fixtures/nativa_nacion.txt`;
4 tests nuevos (41 pytest en total, ruff ok).

## Fuera de alcance
- Cambios en la UI de `/importar` (ya soporta el contrato; solo cambia el parser del micro).
- Detección/creación del medio por titular (FR-16b) → **F2-5**.

## Por qué este modelo
El contrato, la UI y el patrón de parser ya están de F2-3; esto es un parser nuevo acotado.
