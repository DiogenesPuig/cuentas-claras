import { supabase } from '@/lib/supabase';
import type { AliasMap } from './display';

/**
 * Apodos privados del usuario actual (MEJ-8). La RLS de `persona_aliases` ya limita las
 * filas a `auth.uid()`, así que las queries solo filtran por `workspace_id` (claridad).
 * Única capa que toca Supabase (portabilidad).
 */
export async function listAliases(workspaceId: string): Promise<AliasMap> {
  const { data, error } = await supabase
    .from('persona_aliases')
    .select('persona_key, alias')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  const map: AliasMap = {};
  for (const row of data ?? []) map[row.persona_key] = row.alias;
  return map;
}

export async function upsertAlias(
  workspaceId: string,
  personaKey: string,
  alias: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const { error } = await supabase.from('persona_aliases').upsert(
    { user_id: user.id, workspace_id: workspaceId, persona_key: personaKey, alias },
    { onConflict: 'user_id,workspace_id,persona_key' },
  );
  if (error) throw error;
}

export async function deleteAlias(workspaceId: string, personaKey: string): Promise<void> {
  const { error } = await supabase
    .from('persona_aliases')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('persona_key', personaKey);
  if (error) throw error;
}
