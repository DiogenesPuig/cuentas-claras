# BUG-10 OCR de comprobantes: origen/destino de transferencia mal atribuidos (Naranja X, BNA, Mercado Pago)

**Sprint:** Bugs (prod) · **Modelo sugerido:** Sonnet (con casos de prueba reales) · **Depende de:** —

## Objetivo
El comprobante de una transferencia debe atribuir correctamente **quién envía (origen)** y
**quién recibe (destino)**. El destinatario nunca debe terminar marcado como origen, y viceversa.

## Contexto
- Reportado por el usuario probando altas por comprobante (2026-07-01), después de mergear
  `PR #58` (dedupe de `toMatchable`) — **no relacionado**: confirmado que ese PR no toca esta
  lógica (solo el matching de medios contra `holder_name`/`last4`).
- La atribución origen/destino en el front es pura y correcta (`src/lib/transfer-account.ts`:
  `ownerSideFor` — gasto→origen, ingreso→destino); el problema está **antes**, en la extracción
  del comprobante: `services/ingesta/app/parsing/receipts.py` (`extract_origin`/`extract_dest`,
  basados en `_ORIGIN_LABEL`/`_DEST_LABEL` sobre el texto del PDF/imagen; ver también el comentario
  sobre "Recibos mobile (Naranja X, BNA…): la etiqueta va sola y el monto en la [línea siguiente]").
- Síntomas reportados:
  1. **Naranja X**: el comprobante confunde quién transfirió con quién recibió (origen y destino
     invertidos).
  2. **BNA**: el destinatario queda marcado como origen (nunca debería pasar).
  3. **Mercado Pago**: en un ingreso (alguien te devolvió plata), reconoce el origen pero no logra
     identificar el destino — razonable si el comprobante de MP no nombra explícitamente al
     destinatario cuando sos vos (implícito), pero hay que confirmarlo mirando el texto real.

## Pasos
1. Conseguir/generar texto de ejemplo (anonimizado) de comprobantes reales de Naranja X, BNA y
   Mercado Pago con transferencia (los "recibos mobile" mencionados en el comentario de
   `receipts.py`) y agregarlos como casos a `services/ingesta/tests/test_receipts_parsing.py`
   (o `test_llm_extract.py` si el parseo de esos bancos usa el camino LLM en vez de regex).
2. Revisar `_ORIGIN_LABEL`/`_DEST_LABEL` y el layout de "etiqueta sola + monto en la línea
   siguiente" para esos formatos: confirmar si el índice/orden de líneas se está leyendo al
   revés, o si la etiqueta de Naranja X/BNA no matchea el patrón esperado y cae a un fallback
   incorrecto.
3. Para Mercado Pago, confirmar con el texto real si el destino simplemente no está impreso
   (implícito = el usuario) — en ese caso, ver si conviene no exigir `dest_holder` para dar el
   ingreso por bueno (hoy `TransactionForm` ya maneja `dest_holder`/`origin_holder` nulos con
   heurística, pero confirmar que no fuerza una atribución incorrecta).
4. Fix + tests en `services/ingesta/tests/` con los casos reales (anonimizados) que reproducen
   cada bug.

## Criterios de aceptación
- [ ] Un comprobante de Naranja X con transferencia atribuye origen/destino correctamente.
- [ ] Un comprobante de BNA nunca marca al destinatario como origen.
- [ ] Se confirma (con texto real) si Mercado Pago no imprime el destino explícito en un ingreso,
      y el front maneja ese caso sin atribuir mal a nadie.
- [ ] Tests con los 3 casos reales (anonimizados) en `services/ingesta/tests/`.

## Fuera de alcance
- Cambios en el front (`TransactionForm`/`lib/transfer-account.ts`): la atribución de "lado dueño"
  ya es correcta ahí; el bug está en la extracción del comprobante (`services/ingesta`).

## Por qué este modelo
Sonnet: fix de parsing acotado a un módulo puro (`receipts.py`), con tests que reproducen el bug
a partir de texto real de comprobante.
