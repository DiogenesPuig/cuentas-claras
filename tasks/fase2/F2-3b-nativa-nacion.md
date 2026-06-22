# F2-3b Parser de Nativa-Nación (Mastercard) por coordenadas

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** F2-3 ✅

## Objetivo
Sumar al dispatcher de resúmenes (F2-3) un parser para el layout **Nativa Internacional
(Banco Nación, Mastercard)**, que NO sale tabular por líneas (la extracción de texto plano
dio **0 filas**) y requiere `pdfplumber` por **coordenadas/tablas** (`page.extract_tables()`
o `extract_words()` con posiciones).

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
- [ ] Un resumen Nativa-Nación genera filas con monto/fecha/descripción/cuotas correctos, agrupadas por tarjeta.
- [ ] El dispatcher elige el parser correcto sin romper el tabular de Patagonia.
- [ ] Lógica de parseo testeada con fixtures anonimizados; `pytest`/`ruff` ok.

## Fuera de alcance
- Cambios en la UI de `/importar` (ya soporta el contrato; solo cambia el parser del micro).

## Por qué este modelo
El contrato, la UI y el patrón de parser ya están de F2-3; esto es un parser nuevo acotado.
