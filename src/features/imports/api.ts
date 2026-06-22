import { supabase } from '@/lib/supabase';
import type { TablesInsert } from '@/lib/database.types';
import { parseStatement, type StatementParse } from '@/lib/ingesta';

export type { StatementParse, StatementCard, StatementRow } from '@/lib/ingesta';

/**
 * Parsea un resumen de tarjeta (PDF) vía el microservicio de ingesta (FR-16).
 * Esta función es la que toca Supabase (saca el access token); el HTTP puro vive
 * en `lib/ingesta`. La password (si el PDF está protegido) viaja al micro y no se
 * guarda en ningún lado.
 */
export async function parseStatementFile(file: File, password?: string): Promise<StatementParse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return parseStatement(file, {
    baseUrl: import.meta.env.VITE_INGESTA_URL,
    accessToken: session?.access_token,
    password,
  });
}

/** Una fila ya revisada/lista para crear como movimiento. */
export interface ImportRowInput {
  amount: number;
  currency: string;
  description: string | null;
  accountId: string | null;
  categoryId: string | null;
  /** Fecha del consumo (ISO YYYY-MM-DD). */
  occurredOn: string;
  installmentN: number | null;
  installmentTotal: number | null;
}

/**
 * Sube el PDF del resumen a `attachments` (`kind='statement'`) y crea los movimientos
 * confirmados en bloque (`source='statement_import'`, `charged_on` = cierre del resumen),
 * bajo la RLS del usuario. Devuelve cuántos se crearon.
 */
export async function confirmStatementImport(
  workspaceId: string,
  file: File,
  rows: ImportRowInput[],
  chargedOn: string | null,
): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');
  if (rows.length === 0) return 0;

  // 1. Guardar el resumen original (auditoría / FR-15).
  const path = `${workspaceId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
  if (uploadError) throw uploadError;

  const { data: attachment, error: attachError } = await supabase
    .from('attachments')
    .insert({
      workspace_id: workspaceId,
      uploaded_by: user.id,
      file_url: path,
      file_type: 'pdf',
      kind: 'statement',
      status: 'processed',
    })
    .select()
    .single();
  if (attachError) throw attachError;

  // 2. Crear los movimientos en bloque.
  const payload: TablesInsert<'transactions'>[] = rows.map((row) => ({
    workspace_id: workspaceId,
    created_by: user.id,
    source: 'statement_import',
    type: 'expense',
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    category_id: row.categoryId,
    account_id: row.accountId,
    occurred_on: row.occurredOn,
    charged_on: chargedOn,
    installment_n: row.installmentN,
    installment_total: row.installmentTotal,
    attachment_id: attachment.id,
  }));

  const { error: insertError } = await supabase.from('transactions').insert(payload);
  if (insertError) throw insertError;
  return payload.length;
}
