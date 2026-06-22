// Import directo del módulo puro (no del barrel `@/features/transactions`): el barrel
// re-exporta `api.ts` (Supabase), que rompe esta lógica pura en tests sin env.
import { displayToIsoDate, isoToDisplayDate } from '@/features/transactions/format';
import { statementExternalHash } from '@/lib/dedupe';
import { suggestCategory, type SuggestableCategory } from '@/lib/category-suggest';
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
  /** Clave de dedupe (FR-17). */
  externalHash: string;
  /** Ya existe en la DB o se repite en este mismo lote → se destilda y se marca. */
  duplicate: boolean;
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

/**
 * Parseo del micro → modelo editable. Solo los pagos de tarjeta van destildados.
 * Marca como `duplicate` (y destilda) las filas cuyo `external_hash` ya existe en
 * la DB (`existingHashes`) o que se repiten dentro del mismo lote. Si se pasan
 * `categories`, precarga la categoría sugerida por descripción (F2-6, editable).
 */
export function buildStagingModel(
  parse: StatementParse,
  existingHashes: ReadonlySet<string> = new Set(),
  categories: readonly SuggestableCategory[] = [],
): StagingModel {
  const seen = new Set<string>();
  return {
    statementCloseOn: parse.statement_close_on,
    cards: parse.cards.map((card) => ({
      accountHint: card.account_hint,
      accountId: '',
      rows: card.rows.map((row) => {
        const externalHash = statementExternalHash({
          last4: card.account_hint.last4,
          occurredOn: row.occurred_on,
          amount: row.amount,
          installmentN: row.installment?.n ?? null,
          installmentTotal: row.installment?.total ?? null,
          ref: row.ref,
          description: row.description,
        });
        const duplicate = existingHashes.has(externalHash) || seen.has(externalHash);
        seen.add(externalHash);
        return {
          id: newId(),
          // Pagos de tarjeta y duplicados van destildados; el resto, tildado.
          include: row.kind !== 'payment' && !duplicate,
          description: row.description ?? '',
          amount: row.amount != null ? String(row.amount) : '',
          currency: row.currency ?? 'ARS',
          occurredOn: isoToDisplayDate(row.occurred_on),
          // Categoría sugerida por el comercio (F2-6, FR-19); editable por el usuario.
          categoryId: suggestCategory(row.description, categories)?.id ?? '',
          installmentN: row.installment?.n ?? null,
          installmentTotal: row.installment?.total ?? null,
          kind: row.kind,
          externalHash,
          duplicate,
        };
      }),
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
        externalHash: row.externalHash,
      });
    }
  }
  return out;
}
