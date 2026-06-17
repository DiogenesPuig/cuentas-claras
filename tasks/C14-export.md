# C14 Exportar CSV/XLSX

**Sprint:** C · **Modelo sugerido:** Haiku · **Depende de:** B10

## Objetivo
Exportar los movimientos del período/filtros activos a CSV y XLSX.

## Contexto
- `PRD.md` §5.6 (FR-23).
- `wireframes/wireframes_fase1.html` pantalla 4 (botón "Exportar").

## Archivos a crear/editar
- `src/features/transactions/export.ts` (armado de filas) + `components/ExportButton`.

## Pasos
1. Tomar los movimientos ya filtrados (misma query que la lista).
2. Mapear a filas planas: fecha, se-cobra, tipo, monto, moneda, persona, medio, banco, categoría, descripción.
3. CSV nativo (sin librerías) y XLSX con SheetJS (si ya está disponible) o CSV únicamente si se quiere evitar dependencia — **decidir según CLAUDE.md** (no agregar dep sin autorización; si hace falta XLSX, escalar).
4. Descargar el archivo en el navegador.

## Criterios de aceptación
- [ ] Exporta el set filtrado actual a CSV correctamente (encoding UTF-8, separador coherente).
- [ ] Los montos y fechas salen en formato legible.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Programar exportaciones automáticas.

## Tests
- Test de la función que mapea movimientos → filas (CSV).

## Por qué este modelo
Haiku: transformación de datos a CSV es mecánica. La única decisión (sumar dep para XLSX) está marcada para escalar, así no improvisa.
