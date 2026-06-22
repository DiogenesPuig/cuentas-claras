-- ============================================================================
-- 0008_transactions_allow_refunds — permitir montos negativos (reintegros)
-- ============================================================================
-- Un reintegro/devolución de un resumen de tarjeta (F2-3) es, conceptualmente,
-- un GASTO NEGATIVO: debe restar del gasto por tarjeta/categoría para que el
-- total sea el real (neteado), no el bruto.
--
-- El CHECK original `amount > 0` (0001_init) lo impedía. Lo relajamos a
-- `amount <> 0` (sigue prohibiendo el 0, que no tiene sentido). El alta manual
-- mantiene su validación de monto > 0 en el front; los negativos solo entran por
-- la importación de resúmenes.
-- ============================================================================

alter table transactions drop constraint transactions_amount_check;

alter table transactions
  add constraint transactions_amount_check check (amount <> 0);
