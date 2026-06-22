import { displayToIsoDate, isoToDisplayDate } from '@/features/transactions';
import type { ImportRowInput } from './api';
import type { StatementAccountHint, StatementParse } from '@/lib/ingesta';

/**
 * Modelo editable del staging (vive en el estado del front, sin persistir).
 * Convierte el parseo del micro en filas editables y, al confirmar, vuelve a
 * `ImportRowInput[]` listos para crear. Lógica pura y testeable.
 */
export interface EditableRow {
  id: string;
  include: boolean;
  description: string;
  /** Editable como texto; se valida al confirmar. */
  amount: string;
  currency: string;
  /** Fecha del consumo en DD/MM/AAAA (display). */
  occurredOn: string;
  categoryId: string;
  installmentN: number | null;
  installmentTotal: number | null;
  kind: 'charge' | 'refund' | 'payment';
}

export interface EditableCard {
  accountHint: StatementAccountHint;
  /** Medio elegido por el usuario para esta tarjeta ('' = sin asignar). */
  accountId: string;
  rows: EditableRow[];
}

export interface StagingModel {
  statementCloseOn: string | null;
  cards: EditableCard[];
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** Parseo del micro → modelo editable. Pagos/devoluciones quedan destildados. */
export function buildStagingModel(parse: StatementParse): StagingModel {
  return {
    statementCloseOn: parse.statement_close_on,
    cards: parse.cards.map((card) => ({
      accountHint: card.account_hint,
      accountId: '',
      rows: card.rows.map((row) => ({
        id: newId(),
        // Consumos y reintegros se importan; solo los pagos de tarjeta van destildados.
        include: row.kind !== 'payment',
        description: row.description ?? '',
        amount: row.amount != null ? String(row.amount) : '',
        currency: row.currency ?? 'ARS',
        occurredOn: isoToDisplayDate(row.occurred_on),
        categoryId: '',
        installmentN: row.installment?.n ?? null,
        installmentTotal: row.installment?.total ?? null,
        kind: row.kind,
      })),
    })),
  };
}

/** ¿La fila está lista para importar (incluida, con monto > 0 y fecha válida)? */
export function isRowValid(row: EditableRow): boolean {
  return row.include && Number(row.amount) > 0 && displayToIsoDate(row.occurredOn) !== '';
}

/** Cuántas filas se importarían con el estado actual. */
export function countSelected(model: StagingModel): number {
  return model.cards.reduce((acc, card) => acc + card.rows.filter(isRowValid).length, 0);
}

/** Modelo editable → inputs listos para crear (solo filas válidas e incluidas). */
export function toImportRows(model: StagingModel): ImportRowInput[] {
  const out: ImportRowInput[] = [];
  for (const card of model.cards) {
    for (const row of card.rows) {
      if (!isRowValid(row)) continue;
      // Un reintegro es un gasto NEGATIVO: netea el total por tarjeta/categoría.
      const magnitude = Number(row.amount);
      out.push({
        amount: row.kind === 'refund' ? -magnitude : magnitude,
        currency: row.currency.toUpperCase(),
        description: row.description.trim() || null,
        accountId: card.accountId || null,
        categoryId: row.categoryId || null,
        occurredOn: displayToIsoDate(row.occurredOn),
        installmentN: row.installmentN,
        installmentTotal: row.installmentTotal,
      });
    }
  }
  return out;
}
