import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type Category = Tables<'categories'>;
export type CategoryKind = Database['public']['Enums']['category_kind'];

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon?: string | null;
  color?: string | null;
}

/** Categorías globales (`workspace_id is null`) + propias del workspace. */
export async function listCategories(workspaceId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Crea una categoría propia del workspace (RLS exige rol owner/admin). */
export async function createCategory(
  workspaceId: string,
  input: CategoryInput,
): Promise<Category> {
  const payload: TablesInsert<'categories'> = {
    workspace_id: workspaceId,
    name: input.name,
    kind: input.kind,
    icon: input.icon ?? null,
    color: input.color ?? null,
  };

  const { data, error } = await supabase.from('categories').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Edita una categoría propia del workspace (RLS exige rol owner/admin). */
export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<Category> {
  const payload: TablesUpdate<'categories'> = {
    name: input.name,
    kind: input.kind,
    icon: input.icon ?? null,
    color: input.color ?? null,
  };

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
