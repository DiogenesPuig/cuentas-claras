import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type Workspace = Tables<'workspaces'>;
export type MemberRole = Database['public']['Enums']['member_role'];
export type Invitation = Tables<'invitations'>;

export interface Member {
  /** Id de `workspace_members` (el que se usa para cambiar rol / quitar). */
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: MemberRole;
}

export interface InviteInput {
  email: string;
  role: MemberRole;
}

export interface WorkspaceSettingsInput {
  name: string;
  baseCurrency: string;
  fxQuote: string;
}

export interface InvitationPreview {
  workspaceId: string;
  workspaceName: string;
  role: MemberRole;
  email: string;
  isExpired: boolean;
  isUsable: boolean;
}

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

/** Rol del usuario autenticado en el workspace, o `null` si no es miembro. */
export async function getMyRole(workspaceId: string): Promise<MemberRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

/** Datos del workspace (para `WorkspaceSettings`). */
export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  if (error) throw error;
  return data;
}

/** Edita name/base_currency/fx_quote (RLS exige rol owner/admin). */
export async function updateWorkspaceSettings(
  workspaceId: string,
  input: WorkspaceSettingsInput,
): Promise<Workspace> {
  const payload: TablesUpdate<'workspaces'> = {
    name: input.name,
    base_currency: input.baseCurrency,
    fx_quote: input.fxQuote,
  };
  const { data, error } = await supabase
    .from('workspaces')
    .update(payload)
    .eq('id', workspaceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Miembros del workspace con nombre/avatar/rol. El nombre/avatar vienen de
 * `member_directory` (no de `profiles`, que solo es legible por su dueño) —
 * esa vista nunca expone el teléfono.
 */
export async function listMembers(workspaceId: string): Promise<Member[]> {
  const [membersRes, directoryRes] = await Promise.all([
    supabase.from('workspace_members').select('id, user_id, role').eq('workspace_id', workspaceId),
    supabase
      .from('member_directory')
      .select('user_id, name, avatar_url')
      .eq('workspace_id', workspaceId),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (directoryRes.error) throw directoryRes.error;

  const directoryByUser = new Map((directoryRes.data ?? []).map((row) => [row.user_id, row]));

  return (membersRes.data ?? []).map((member) => {
    const directory = directoryByUser.get(member.user_id);
    return {
      id: member.id,
      userId: member.user_id,
      name: directory?.name ?? 'Sin nombre',
      avatarUrl: directory?.avatar_url ?? null,
      role: member.role,
    };
  });
}

/** Cambia el rol de un miembro (RLS exige rol owner/admin). */
export async function updateMemberRole(memberId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId);
  if (error) throw error;
}

/** Quita a un miembro del workspace (RLS exige rol owner/admin). */
export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
  if (error) throw error;
}

/** Invitaciones del workspace, más recientes primero (RLS exige rol owner/admin). */
export async function listInvitations(workspaceId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Crea una invitación pendiente (token y vencimiento a 7 días los pone la DB). */
export async function createInvitation(
  workspaceId: string,
  input: InviteInput,
): Promise<Invitation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const payload: TablesInsert<'invitations'> = {
    workspace_id: workspaceId,
    email: input.email,
    role: input.role,
    invited_by: user.id,
  };
  const { data, error } = await supabase.from('invitations').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Datos de una invitación a partir de su token, para mostrarlos antes de
 * aceptarla. `null` si el token no existe. Usa una función `SECURITY DEFINER`
 * porque quien todavía no es miembro no puede leer `invitations` por RLS.
 */
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('invitation_preview', { p_token: token });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    role: row.role,
    email: row.email,
    isExpired: row.is_expired,
    isUsable: row.is_usable,
  };
}

/**
 * Acepta una invitación válida: agrega al usuario autenticado como miembro y
 * devuelve el `workspace_id` resultante. Rechaza tokens vencidos/inválidos.
 */
export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) throw error;
  return data;
}
