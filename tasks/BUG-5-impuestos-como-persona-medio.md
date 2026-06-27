# BUG-5 Los impuestos se tratan como una "persona" y un "medio"

**Sprint:** Bugs / diseño · **Modelo sugerido:** Opus (decisión de modelado) + Sonnet (impl) · **Depende de:** F2-11

## Problema (reportado por el usuario, 2026-06-27)
Al cargar un comprobante de **pago de impuestos** (ej. AFIP/ARCA, servicios), el flujo de
transferencias lo trata como si el destinatario fuera **una persona** y le crea/asocia un **medio
`'transfer'`**, igual que a un miembro o a otra persona. Queda "raro": un impuesto no es una persona
ni un medio de pago del grupo. Hay que manejarlo distinto.

## Contexto
- F2-11 (en `tasks/done/`): un único medio `'transfer'` por **persona**; el titular del lado dueño
  se matchea a un miembro y, si no, se crea un medio por `holder_name`. Lógica en
  `src/features/transactions/components/TransactionForm.tsx` (efectos de `transferInfo` →
  `getOrCreateTransferAccount`) + `src/lib/transfer-account.ts` + extracción en el micro
  (`receipts.py`, origin/dest holder).
- El problema: cuando el origen/destino es un **ente impositivo/servicio** (no una persona), igual
  se dispara la creación del medio `'transfer'` y la atribución de persona.

## A decidir (Opus) antes de implementar
- **Cómo modelar un pago de impuesto/servicio:** ¿una **categoría** "Impuestos" sin medio
  `'transfer'` ni persona? ¿un tipo de destinatario "entidad" distinto de "persona"? ¿detección por
  heurística (palabras clave: AFIP, ARCA, IVA, ingresos brutos, rentas, etc.) y/o marca manual del
  usuario en el alta?
- **Quién decide:** ¿auto-detección + override manual, o solo manual (un checkbox/tipo en el form)?
- Evitar falsos positivos (principio rector: mejor no clasificar que clasificar mal).

## Criterios de aceptación (a afinar tras la decisión)
- [ ] Cargar un comprobante de impuesto NO crea una "persona" ni un medio `'transfer'` espurio.
- [ ] El impuesto queda representado de forma sensata (categoría/tipo), editable por el usuario.
- [ ] No rompe el flujo normal de transferencias entre personas.

## Fuera de alcance
- Integraciones con organismos; solo el modelado/UX del alta.
