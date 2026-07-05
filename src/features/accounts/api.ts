import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { findTransferAccount } from '@/lib/transfer-account';

export type Account = Tables<'accounts'>;
export type AccountType = Database['public']['Enums']['account_type'];
export type CardNetwork = Database['public']['Enums']['card_network'];

export interface AccountInput {
  name: string;
  bank: string | null;
  network: CardNetwork | null;
  type: AccountType;
  currency: string;
  last4: string | null;
  ownerMemberId: string | null;
  holderName: string;
  isExtension: boolean;
  parentAccountId: string | null;
  billingCloseDay: number | null;
}

export interface MemberOption {
  /** Id de `workspace_members`, el valor que se guarda en `accounts.owner_member_id`. */
  id: string;
  name: string;
}

/** Medios/tarjetas no archivados del workspace, en orden alfabético. */
export async function listAccounts(workspaceId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Miembros del workspace, para elegir el holder de un medio.
 * `profiles` solo es legible por su propio dueño, por eso el nombre se busca en
 * la vista `member_directory` (en vez de un join directo a `profiles`).
 */
export async function listMembersForHolder(workspaceId: string): Promise<MemberOption[]> {
  const [membersRes, directoryRes] = await Promise.all([
    supabase.from('workspace_members').select('id, user_id').eq('workspace_id', workspaceId),
    supabase.from('member_directory').select('user_id, name').eq('workspace_id', workspaceId),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (directoryRes.error) throw directoryRes.error;

  const namesByUser = new Map(
    (directoryRes.data ?? []).map((row) => [row.user_id, row.name ?? 'Sin nombre']),
  );

  return (membersRes.data ?? []).map((m) => ({
    id: m.id,
    name: namesByUser.get(m.user_id) ?? 'Sin nombre',
  }));
}

function toRow(input: AccountInput) {
  return {
    name: input.name,
    bank: input.bank,
    network: input.network,
    type: input.type,
    currency: input.currency,
    last4: input.last4,
    owner_member_id: input.ownerMemberId,
    holder_name: input.holderName,
    is_extension: input.isExtension,
    parent_account_id: input.parentAccountId,
    billing_close_day: input.billingCloseDay,
  };
}

/** Crea un medio/tarjeta propio del workspace (RLS exige rol owner/admin). */
export async function createAccount(workspaceId: string, input: AccountInput): Promise<Account> {
  const payload: TablesInsert<'accounts'> = { workspace_id: workspaceId, ...toRow(input) };
  const { data, error } = await supabase.from('accounts').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Edita un medio/tarjeta (RLS exige rol owner/admin). */
export async function updateAccount(id: string, input: AccountInput): Promise<Account> {
  const payload: TablesUpdate<'accounts'> = toRow(input);
  const { data, error } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Actualiza solo los alias de titular de un medio (MEJ-4). Normaliza: recorta, descarta vacíos
 * y duplica-insensible (por si el usuario repite un nombre). RLS exige rol owner/admin.
 */
export async function updateHolderAliases(id: string, aliases: string[]): Promise<Account> {
  const cleaned = Array.from(
    new Map(
      aliases
        .map((a) => a.trim())
        .filter((a) => a.length > 0)
        .map((a) => [a.toLowerCase(), a]),
    ).values(),
  );
  const payload: TablesUpdate<'accounts'> = { holder_aliases: cleaned };
  const { data, error } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface TransferAccountHolder {
  /** Si el titular matchea a un miembro, su `workspace_members.id`. */
  ownerMemberId: string | null;
  holderName: string;
}

/**
 * Busca el medio `'transfer'` de una persona y, si no existe, lo crea (F2-11): un
 * único medio "Transferencia" por persona (titular o miembro), sin banco —el banco
 * del comprobante va a `transactions.bank`. Lazy: no se pre-crean medios vacíos.
 *
 * MEJ-4: usa el **mismo** matcher puro que el pre-match del front (`findTransferAccount`):
 * por `owner_member_id`, y si no, fuzzy por titular incluyendo `holder_aliases`. Antes esta
 * capa buscaba por `holder_name` EXACTO y creaba duplicados ante variantes de orden/tildes/apodos.
 */
export async function getOrCreateTransferAccount(
  workspaceId: string,
  holder: TransferAccountHolder,
): Promise<Account> {
  const { data: transferAccounts, error: selectError } = await supabase
    .from('accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('type', 'transfer');
  if (selectError) throw selectError;

  const existing = findTransferAccount(
    holder.holderName,
    holder.ownerMemberId,
    transferAccounts ?? [],
  );
  if (existing) return existing;

  const payload: TablesInsert<'accounts'> = {
    workspace_id: workspaceId,
    name: 'Transferencia',
    type: 'transfer',
    owner_member_id: holder.ownerMemberId,
    holder_name: holder.holderName,
  };
  const { data: created, error: insertError } = await supabase
    .from('accounts')
    .insert(payload)
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
}
