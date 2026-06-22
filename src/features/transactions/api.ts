import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { extractReceipt, type ReceiptExtraction } from '@/lib/ingesta';
import { buildTransactionFilterArgs, type TransactionFilters } from './filters';

export type Transaction = Tables<'transactions'>;
export type TransactionType = Database['public']['Enums']['transaction_type'];
export type Attachment = Tables<'attachments'>;

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  categoryId: string | null;
  accountId: string | null;
  occurredOn: string;
  chargedOn: string | null;
  attachmentId: string | null;
}

export interface TransactionView extends Transaction {
  account: { name: string; holder_name: string; bank: string | null } | null;
  category: { name: string; icon: string | null } | null;
}

const TRANSACTION_SELECT =
  '*, account:accounts(name,holder_name,bank), category:categories(name,icon)';
/** Igual que `TRANSACTION_SELECT`, pero con `!inner` para poder filtrar por `account.holder_name`. */
const TRANSACTION_SELECT_INNER_ACCOUNT =
  '*, account:accounts!inner(name,holder_name,bank), category:categories(name,icon)';

/**
 * Movimientos del workspace, más recientes primero, con los filtros de FR-11
 * aplicados en la query (mes, medio, categoría, moneda, persona/holder y texto).
 */
export async function listTransactions(
  workspaceId: string,
  filters: TransactionFilters = {},
): Promise<TransactionView[]> {
  const args = buildTransactionFilterArgs(filters);

  let query = supabase
    .from('transactions')
    .select(args.holderName ? TRANSACTION_SELECT_INNER_ACCOUNT : TRANSACTION_SELECT)
    .eq('workspace_id', workspaceId);

  if (args.occurredFrom) query = query.gte('occurred_on', args.occurredFrom);
  if (args.occurredTo) query = query.lt('occurred_on', args.occurredTo);
  if (args.accountId) query = query.eq('account_id', args.accountId);
  if (args.categoryId) query = query.eq('category_id', args.categoryId);
  if (args.currency) query = query.eq('currency', args.currency);
  if (args.holderName) query = query.eq('account.holder_name', args.holderName);
  if (args.search) query = query.ilike('description', `%${args.search}%`);

  const { data, error } = await query
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TransactionView[];
}

function toRow(input: TransactionInput) {
  return {
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    category_id: input.categoryId,
    account_id: input.accountId,
    occurred_on: input.occurredOn,
    charged_on: input.chargedOn,
    attachment_id: input.attachmentId,
  };
}

/** Crea un movimiento manual (`source = 'manual'`, `created_by = auth.uid()`). */
export async function createTransaction(
  workspaceId: string,
  input: TransactionInput,
): Promise<Transaction> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const payload: TablesInsert<'transactions'> = {
    workspace_id: workspaceId,
    created_by: user.id,
    source: 'manual',
    ...toRow(input),
  };
  const { data, error } = await supabase.from('transactions').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Edita un movimiento (RLS exige ser el autor o admin/owner del workspace). */
export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  const payload: TablesUpdate<'transactions'> = toRow(input);
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Elimina un movimiento (RLS exige ser el autor o admin/owner del workspace). */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Sube un comprobante al bucket privado `attachments` (path `{workspaceId}/...`) y crea su fila.
 * Devuelve el `attachment_id` para asociarlo a la transacción.
 */
export async function uploadAttachment(workspaceId: string, file: File): Promise<Attachment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const path = `${workspaceId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
  if (uploadError) throw uploadError;

  const payload: TablesInsert<'attachments'> = {
    workspace_id: workspaceId,
    uploaded_by: user.id,
    file_url: path,
    file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
    kind: 'receipt',
  };
  const { data, error } = await supabase.from('attachments').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export type { ReceiptExtraction } from '@/lib/ingesta';

/**
 * OCR de un comprobante vía el microservicio de ingesta (FR-14). Esta función es
 * la que toca Supabase (saca el access token de la sesión); el HTTP puro vive en
 * `lib/ingesta`. Devuelve los campos detectados para precargar el form de alta.
 */
export async function extractReceiptData(file: File): Promise<ReceiptExtraction> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return extractReceipt(file, {
    baseUrl: import.meta.env.VITE_INGESTA_URL,
    accessToken: session?.access_token,
  });
}

/** Signed URL temporal para mostrar/descargar un comprobante del bucket privado. */
export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}
