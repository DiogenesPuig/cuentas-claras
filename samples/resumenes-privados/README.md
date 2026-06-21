# Resúmenes de tarjeta privados (referencia local)

> ⚠️ **Esta carpeta está en `.gitignore`. Nada de acá se commitea, salvo este README.**
> Los resúmenes reales tienen datos personales (nombre, número de tarjeta, movimientos)
> y **no deben subirse al repositorio bajo ningún concepto**.

## Para qué es

Resúmenes reales del dueño del proyecto, usados **solo en local** como referencia para
construir y validar los parsers de Fase 2 (ver `tasks/fase2/F2-3-parseo-resumenes-staging.md`).
Sirven para entender el layout de cada banco/red y para probar el parseo a mano.

## Convención sugerida de nombres

```
samples/resumenes-privados/
  nacion/
    visa-2025-11.pdf
    mastercard-2025-11.pdf
  patagonia/
    visa-2025-11.pdf
```

(Banco como subcarpeta; archivo `red-AAAA-MM.pdf`.)

## Tests automatizados: NO usar estos archivos

Los tests del parser (`pytest`) deben correr contra **fixtures anonimizados/sintéticos**
versionables, no contra estos PDFs privados. La estrategia de fixtures anonimizados se
define en F2-3. Estos archivos son para inspección manual y desarrollo, no para CI.
