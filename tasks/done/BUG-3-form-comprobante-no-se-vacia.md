# BUG-3 El form de alta no se vacía al reintentar con otro comprobante

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Si el usuario carga un comprobante, se equivoca e intenta cargar **otro**, y la segunda
extracción **falla** (o no extrae nada), la interfaz **no debe** quedar con los datos del
comprobante viejo precargados. Debe vaciarse / reflejar que la nueva carga no trajo datos.

## Contexto
- Reportado por el usuario probando OCR (2026-06-27).
- Form de alta: `src/features/transactions/components/TransactionForm.tsx`. Tiene estado de OCR
  (`ocrLoading`, `ocrMessage`, `ocrApplied`, `transferInfo`) y precarga valores vía `reset(...)`.
- Extracción: `useExtractReceipt` (`src/features/transactions/hooks.ts`) → `extractReceiptData`
  (`src/features/transactions/api.ts`) → micro de ingesta.
- Bug: al seleccionar un segundo archivo, los campos precargados del primero siguen ahí si la
  segunda extracción falla o devuelve vacío.

## Pasos
1. Reproducir: subir comprobante A (precarga datos) → subir comprobante B que falle/no extraiga.
2. Al iniciar una **nueva** extracción, limpiar los valores precargados y el estado de OCR
   (`ocrMessage`/`ocrApplied`/`transferInfo`) **antes** de aplicar el nuevo resultado; si el nuevo
   resultado viene vacío o falla, dejar el form limpio (o con un aviso claro), no con lo viejo.
3. No romper el caso normal (extracción exitosa precarga bien) ni la edición de un movimiento.
4. `typecheck` / `lint` / `test` (hay `TransactionForm.test.tsx`, ampliar si aplica).

## Criterios de aceptación
- [ ] Cargar un segundo comprobante que falla deja el form **sin** los datos del primero.
- [ ] Una extracción exitosa sigue precargando correctamente.
- [ ] La edición de un movimiento existente no se ve afectada.

## Fuera de alcance
- Cambios en el micro de ingesta (es un fix de UI/estado en el front).

## Por qué este modelo
Sonnet: fix de manejo de estado en un componente existente, con tests ya presentes.
