import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { extractReceipt, type ReceiptExtraction } from '@/lib/ingesta';
import { sha256Hex } from '@/lib/file-hash';
import {
  findDuplicates,
  SIMILAR_DATE_WINDOW_DAYS,
  type DuplicateReason,
} from '@/lib/duplicate-detect';
import { buildTransactionFilterArgs, type TransactionFilters } from './filters';

export type Transaction = Tables<'transactions'>;
export type TransactionType = Database['public']['Enums']['transaction_type'];
export type Attachment = Tables<'attachments'>;

export type TransactionSource = Database['public']['Enums']['transaction_source'];

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  categoryId: string | null;
  accountId: string | null;
  /** Banco del movimiento (F2-11): hoy solo lo llena el flujo de transferencias. */
  bank: string | null;
  occurredOn: string;
  chargedOn: string | null;
  attachmentId: string | null;
  /** Origen del alta. Default `'manual'`; `'ocr'` si se precargó desde un comprobante (FR-14). */
  source?: TransactionSource;
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
    bank: input.bank,
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
    source: input.source ?? 'manual',
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

  // Hash del contenido (F2-13): permite avisar "ya subiste este comprobante". Si no se puede
  // calcular (sin crypto.subtle), queda null y la detección cae a monto+fecha.
  const contentHash = await sha256Hex(await file.arrayBuffer());

  const payload: TablesInsert<'attachments'> = {
    workspace_id: workspaceId,
    uploaded_by: user.id,
    file_url: path,
    file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
    kind: 'receipt',
    content_hash: contentHash,
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

/** Resuelve `file_url`/`file_type` de un comprobante a partir de su `attachment_id`. */
export async function getAttachment(id: string): Promise<Attachment> {
  const { data, error } = await supabase.from('attachments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Signed URL temporal para mostrar/descargar un comprobante del bucket privado. */
export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

// ── F2-13: aviso de duplicado al dar de alta ───────────────────────────────────────────────

export interface DuplicateCriteria {
  amount: number;
  currency: string;
  occurredOn: string;
  accountId: string | null;
  description: string | null;
  /** Hash del comprobante que se va a subir (o null si no hay archivo / no se pudo calcular). */
  contentHash: string | null;
}

export interface DuplicateCandidateView {
  id: string;
  amount: number;
  currency: string;
  occurredOn: string;
  description: string | null;
  accountName: string | null;
  attachmentId: string | null;
  reason: DuplicateReason;
}

const CANDIDATE_SELECT =
  'id, amount, currency, occurred_on, account_id, description, attachment_id, account:accounts(name), attachment:attachments(content_hash)';

interface CandidateRow {
  id: string;
  amount: number;
  currency: string;
  occurred_on: string;
  account_id: string | null;
  description: string | null;
  attachment_id: string | null;
  account: { name: string } | null;
  attachment: { content_hash: string | null } | null;
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Movimientos del workspace que podrían ser un duplicado del alta en curso (F2-13). Trae dos
 * conjuntos: (A) mismo monto+moneda en la ventana de fecha, y (B) los que comparten el hash del
 * comprobante; el criterio/motivo final lo decide `lib/duplicate-detect` (puro). Solo para alta
 * nueva (en edición no se llama).
 */
export async function findDuplicateCandidates(
  workspaceId: string,
  criteria: DuplicateCriteria,
): Promise<DuplicateCandidateView[]> {
  const from = shiftIsoDate(criteria.occurredOn, -SIMILAR_DATE_WINDOW_DAYS);
  const to = shiftIsoDate(criteria.occurredOn, SIMILAR_DATE_WINDOW_DAYS);
  const rows = new Map<string, CandidateRow>();

  // A — mismo monto+moneda dentro de la ventana de fecha.
  const { data: byAmount, error: errA } = await supabase
    .from('transactions')
    .select(CANDIDATE_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('currency', criteria.currency)
    .eq('amount', criteria.amount)
    .gte('occurred_on', from)
    .lte('occurred_on', to);
  if (errA) throw errA;
  for (const row of (byAmount ?? []) as CandidateRow[]) rows.set(row.id, row);

  // B — mismo archivo (hash), sin importar monto/fecha.
  if (criteria.contentHash) {
    const { data: byHash, error: errB } = await supabase
      .from('transactions')
      .select(
        'id, amount, currency, occurred_on, account_id, description, attachment_id, account:accounts(name), attachment:attachments!inner(content_hash)',
      )
      .eq('workspace_id', workspaceId)
      .eq('attachment.content_hash', criteria.contentHash);
    if (errB) throw errB;
    for (const row of (byHash ?? []) as CandidateRow[]) rows.set(row.id, row);
  }

  const existing = [...rows.values()].map((row) => ({
    ...row,
    accountName: row.account?.name ?? null,
    attachmentContentHash: row.attachment?.content_hash ?? null,
  }));

  return findDuplicates(
    {
      amount: criteria.amount,
      currency: criteria.currency,
      occurredOn: criteria.occurredOn,
      accountId: criteria.accountId,
      description: criteria.description,
      contentHash: criteria.contentHash,
    },
    existing,
  ).map(({ tx, reason }) => ({
    id: tx.id,
    amount: tx.amount,
    currency: tx.currency,
    occurredOn: tx.occurred_on,
    description: tx.description,
    accountName: tx.accountName,
    attachmentId: tx.attachment_id,
    reason,
  }));
}
