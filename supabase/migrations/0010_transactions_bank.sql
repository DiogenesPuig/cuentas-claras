-- ============================================================================
-- 0010_transactions_bank — banco del movimiento (F2-11)
-- ============================================================================
-- El medio `'transfer'` (0009) es por persona, no por banco (una persona transfiere
-- desde varios bancos). El banco del comprobante pasa a vivir en el movimiento.
-- Nullable: hoy solo lo llena el flujo de transferencias; el resto de los
-- movimientos no cambia.
-- ============================================================================

alter table transactions add column bank text;

comment on column transactions.bank is
  'Banco del movimiento (hoy solo lo llena el flujo de transferencias, F2-11). NULL si no aplica.';
