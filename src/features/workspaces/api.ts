import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/lib/database.types';

export type Workspace = Tables<'workspaces'>;

export interface CreateWorkspaceInput {
  name: string;
  base_currency: string;
}

/** Workspaces a los que pertenece el usuario autenticado (vía `workspace_members`). */
export async function listMyWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace:workspaces(*)')
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .map((row) => row.workspace)
    .filter((ws): ws is Workspace => ws !== null);
}

/**
 * Crea un workspace con el usuario autenticado como `owner_id`.
 * El trigger `trg_ws_add_owner` lo agrega además como `owner` en `workspace_members`.
 */
export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const payload: TablesInsert<'workspaces'> = {
    name: input.name,
    base_currency: input.base_currency,
    owner_id: user.id,
  };

  const { data, error } = await supabase.from('workspaces').insert(payload).select().single();
  if (error) throw error;
  return data;
}
