-- ============================================================================
-- 0009_account_type_transfer — nuevo valor 'transfer' en account_type (F2-11)
-- ============================================================================
-- Decisión de la charla 2026-06-23 (ver tasks/fase2/F2-11-transferencia-por-persona.md):
-- reemplaza el medio `bank_account` por persona+banco (F2-9) por un único medio
-- `'transfer'` por persona; el banco pasa a vivir en `transactions.bank` (ver
-- 0010_transactions_bank.sql).
--
-- `ADD VALUE` no puede ejecutarse dentro de la misma transacción donde se crea el
-- tipo (ni junto a otro DDL que lo use), por eso va sola en esta migración.
-- ============================================================================

alter type account_type add value 'transfer';
