# BUG-5 Los impuestos se tratan como una "persona" y un "medio"

**Sprint:** Bugs / diseño · **Modelo sugerido:** Sonnet (diseño ya cerrado por Opus + usuario, 2026-06-27) · **Depende de:** F2-11

## Problema (reportado por el usuario, 2026-06-27)
Los pagos de **impuestos/servicios** (AFIP/ARCA, Rentas, ARBA, IVA, percepciones, sellos, luz, gas…)
no se modelan bien. Se da en **dos flujos**:

1. **Comprobante (OCR):** el flujo de transferencias toma al organismo/empresa como si fuera **una
   persona** y le crea/asocia un **medio `'transfer'`**, igual que a un miembro. Un impuesto no es
   ni persona ni medio del grupo.
2. **Resumen de tarjeta (statement):** el resumen trae una **sección de impuestos** (IVA, Ley 25.413,
   percepciones, sellos…). Esas filas hoy **no matchean ninguna regla de categoría** → quedan sin
   categorizar. (Acá NO hay persona/medio espurio: el medio es la tarjeta; el problema es solo la
   categorización.)

## Decisiones de diseño (cerradas con el usuario, 2026-06-27)
- **Detección:** *heurística automática + override manual* (opción 1). Lista conservadora de
  palabras clave (organismos + grandes servicios AR); el usuario puede corregir.
- **Modelado del pago detectado:** **gasto normal** sin medio `'transfer'` ni persona; el nombre de
  la entidad va a la **descripción** y se **sugiere categoría** "Impuestos" (organismos) o
  "Servicios" (empresas de servicios; ya existe).
- **Categoría:** **agregar "Impuestos" (🧾)** al seed global; "Servicios" ya existe.
- **Dónde vive la heurística (decisión técnica, Opus):** **lib pura del front**, NO se toca el micro
  ni el contrato. Los nombres ya vienen extraídos (`origin_holder`/`dest_holder` en el OCR;
  `description` en el resumen); el front los interpreta. Más barato y portable.
- **Principio rector:** *mejor no clasificar que clasificar mal* → keywords específicas
  (bajo riesgo de falso positivo); si no matchea, cae al comportamiento actual (status quo, no peor).

## Contexto / archivos
- F2-11 (en `tasks/done/`): un único medio `'transfer'` por persona. Front:
  `src/features/transactions/components/TransactionForm.tsx` (efectos de `transferInfo` →
  `getOrCreateTransferAccount`), `src/lib/transfer-account.ts`.
- Motor de categorías por keyword (compartido por ambos flujos): `src/lib/category-suggest.ts`
  (ya tiene una regla "Servicios"). El resumen lo usa en `src/features/imports/staging.ts`
  (`suggestCategory(row.description, categories)`); el OCR en el efecto de sugerencia del form.
- Seed de categorías: `db/schema_fase1.sql` (~L470) y `supabase/migrations/0001_init.sql` (~L384).

## Pasos
1. **Migración** `supabase/migrations/00NN_seed_categoria_impuestos.sql`: insertar categoría global
   `(null, 'Impuestos', 'expense', '🧾')` en `categories`. (Categoría global `workspace_id = NULL` →
   queda disponible para todos los workspaces, sin backfill por workspace.) Aplicar **local + remoto**
   (`supabase db push`, verificar con `supabase migration list --linked`). Reflejar también el INSERT
   en `db/schema_fase1.sql` para mantener el esquema de referencia al día.
2. **`src/lib/category-suggest.ts`**: agregar regla `category: ['Impuestos']` con keywords de
   organismos (`afip`, `arca`, `arba`, `agip`, `dgr`, `rentas`, `ingresos brutos`, `monotributo`,
   `vep`, `iva`, `ley 25413`, `ley 25.413`, `percepcion`, `percepciones`, `sellos`, `impuesto`,
   `tasa municipal`, …). Esto resuelve la categorización en **ambos** flujos. Tests en
   `category-suggest.test.ts` (impuesto→"Impuestos"; servicio→"Servicios"; persona→sin match).
3. **`src/lib/payee.ts`** (nuevo, puro + test): `isInstitutionalPayee(name): boolean` reutilizando
   los sets de keywords de Impuestos + Servicios. Detecta que un titular es entidad (no persona).
4. **Comprobante (`TransactionForm.tsx`)**: tras la extracción, si `isInstitutionalPayee(origin)` ó
   `isInstitutionalPayee(dest)` → marcar el alta como **institucional**:
   - NO disparar el efecto de medio `'transfer'` ni la atribución de persona (gatear los efectos con
     `!treatAsInstitutional`; limpiar `accountId` si ya se autoseteó).
   - Poner el nombre de la entidad en la **descripción** y dejar que `suggestCategory` proponga la
     categoría.
   - **Override manual:** toggle "Es un pago a empresa/impuesto (no a una persona)", visible cuando
     hay datos de transferencia; default = resultado de la heurística; el usuario puede prenderlo/apagarlo.
5. **Resumen:** sin cambios estructurales — al existir la categoría "Impuestos" + su regla, las filas
   de impuestos del resumen se autocategorizan vía `suggestCategory` (ya invocado en `staging.ts`).
   El override por fila ya existe (editor de categoría por fila en el staging).
6. `typecheck` / `lint` / `test`. Actualizar READMEs de carpeta si se crean archivos (`src/lib`).

## Criterios de aceptación
- [ ] Cargar un comprobante de impuesto/servicio NO crea una "persona" ni un medio `'transfer'`
      espurio; queda como gasto con categoría "Impuestos"/"Servicios" sugerida y la entidad en la
      descripción.
- [ ] El toggle de override permite forzar/quitar el tratamiento institucional; default = heurística.
- [ ] En un resumen, las filas de la sección de impuestos quedan con categoría "Impuestos" sugerida.
- [ ] No rompe el flujo normal de transferencias entre personas (persona real → sigue creando su
      medio `'transfer'` y atribución).
- [ ] Existe la categoría global "Impuestos" (migración aplicada en remoto) y `db/schema_fase1.sql`
      refleja el seed.
- [ ] Lógica pura (`category-suggest`, `payee`) con tests que pasan.

## Fuera de alcance
- Integraciones con organismos; tocar el micro/contrato de extracción.
- Reportes específicos de impuestos (la categoría ya los separa en los gráficos existentes).
- Alias de titulares (eso es MEJ-4).
