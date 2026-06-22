-- ============================================================================
-- 0007_transactions_installments — soporte de cuotas en `transactions` (F2-0)
-- ============================================================================
-- Prerequisito de F2-3 (parseo de resúmenes). Decisión tomada en
-- `tasks/fase2/PLAN.md` §3: cada fila del resumen es un movimiento por la
-- CUOTA cobrada ese mes (no se guarda la compra completa con un plan a
-- derivar). Estas dos columnas son solo metadata para mostrar/agrupar el
-- "Cuota N/M" que viene en el resumen.
--
-- Ambas son NULLABLES: un movimiento sin cuotas las deja en NULL y no cambia
-- nada de lo existente.
-- ============================================================================

alter table transactions
  add column installment_n     smallint,  -- número de cuota cobrada (ej. 2)
  add column installment_total smallint;  -- total de cuotas del plan (ej. 3)

-- Coherencia del rango cuando ambas están presentes. No afecta a los
-- movimientos sin cuotas (ambas NULL): la condición solo se evalúa cuando las
-- dos no son NULL.
alter table transactions
  add constraint transactions_installment_range_check
  check (
    installment_n is null
    or installment_total is null
    or (installment_n >= 1 and installment_n <= installment_total)
  );

comment on column transactions.installment_n is
  'Número de cuota cobrada en este movimiento (1..installment_total). NULL si no es una compra en cuotas.';
comment on column transactions.installment_total is
  'Total de cuotas del plan al que pertenece la cuota cobrada. NULL si no es una compra en cuotas.';
