import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type Workspace = Tables<'workspaces'>;
export type MemberRole = Database['public']['Enums']['member_role'];
export type Invitation = Tables<'invitations'>;

export interface Member {
  /** Id de `workspace_members` (el que se usa para cambiar rol / quitar). */
  id: string;
  /** `null` para una persona del grupo sin cuenta (placeholder, IDENT-1). */
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  role: MemberRole;
  /** Nombres alternativos de la persona para matchear transferencias (IDENT-1 paso 4). */
  aliases: string[];
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
  /** Nombre del placeholder si la invitación es de promoción (IDENT-1 paso 6); `null` si no. */
  memberName: string | null;
}

export interface CreateWorkspaceInput {
  name: string;
  base_currency: string;
}

/** Workspaces a los que pertenece el usuario autenticado (vía `workspace_members`). */
export async function listMyWorkspaces(): Promise<Workspace[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Filtramos por el usuario actual: la policy `wm_select` (is_member) deja ver a
  // TODOS los miembros de tus grupos, así que sin este filtro el mismo workspace
  // venía repetido una vez por cada miembro (BUG-1).
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace:workspaces(*)')
    .eq('user_id', user.id)
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
 * Elimina un grupo (workspace) y todo lo colgado. La cascada de la DB borra miembros, medios,
 * movimientos, categorías, invitaciones, apodos y comprobantes (filas); los archivos del bucket de
 * Storage quedan huérfanos (fuera de alcance v1, MEJ-15). RLS `ws_delete` exige rol **owner**.
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
  if (error) throw error;
}

/**
 * Miembros del workspace con nombre/avatar/rol. El nombre/avatar vienen de
 * `member_directory` (no de `profiles`, que solo es legible por su dueño) —
 * esa vista nunca expone el teléfono.
 */
export async function listMembers(workspaceId: string): Promise<Member[]> {
  const [membersRes, directoryRes] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('id, user_id, role, aliases')
      .eq('workspace_id', workspaceId),
    supabase
      .from('member_directory')
      .select('member_id, name, avatar_url')
      .eq('workspace_id', workspaceId),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (directoryRes.error) throw directoryRes.error;

  // Se indexa por `member_id` (PK de workspace_members), NO por `user_id`: los placeholders tienen
  // `user_id = NULL` y colisionarían todos en la misma clave (IDENT-1) → mismo nombre para todos.
  const directoryByMember = new Map((directoryRes.data ?? []).map((row) => [row.member_id, row]));

  return (membersRes.data ?? []).map((member) => {
    const directory = directoryByMember.get(member.id);
    return {
      id: member.id,
      userId: member.user_id,
      name: directory?.name ?? 'Sin nombre',
      avatarUrl: directory?.avatar_url ?? null,
      role: member.role,
      aliases: member.aliases ?? [],
    };
  });
}

/** Cambia el rol de un miembro (RLS exige rol owner/admin). */
export async function updateMemberRole(memberId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId);
  if (error) throw error;
}

/**
 * Setea los nombres alternativos (alias) de una persona (IDENT-1 paso 4): sirven para matchear el
 * titular de un comprobante de transferencia contra este miembro/placeholder y no crear duplicados.
 * Recorta y deduplica (case-insensitive, descartando vacíos). RLS exige rol owner/admin (`wm_write`).
 */
export async function updateMemberAliases(memberId: string, aliases: string[]): Promise<void> {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of aliases) {
    const value = raw.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(value);
  }
  const { error } = await supabase
    .from('workspace_members')
    .update({ aliases: cleaned })
    .eq('id', memberId);
  if (error) throw error;
}

/** Quita a un miembro del workspace (RLS exige rol owner/admin). */
export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
  if (error) throw error;
}

/**
 * Crea una "persona del grupo" SIN cuenta (placeholder, IDENT-1): fila de `workspace_members` con
 * `user_id NULL` + nombre. No da acceso a nadie (sin usuario no hay login). RLS exige owner/admin.
 * Devuelve `{ id, name }` (forma de `MemberOption`) para el selector de persona.
 */
export async function createPlaceholderMember(
  workspaceId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: null, name, role: 'member' })
    .select('id, name')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name ?? name };
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

/** Duración de un link de invitación genérico antes de vencer (horas). */
const INVITE_LINK_TTL_HOURS = 48;

/**
 * Crea un link de invitación genérico y reutilizable: una invitación SIN email
 * (`email = null`) que cualquiera con el link puede aceptar hasta que venza
 * (48 hs) o se revoque. A diferencia de las invitaciones por email, aceptarla
 * NO la consume (ver `accept_invitation`, migración 0012).
 */
export async function createInviteLink(workspaceId: string, role: MemberRole): Promise<Invitation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const expiresAt = new Date(Date.now() + INVITE_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const payload: TablesInsert<'invitations'> = {
    workspace_id: workspaceId,
    email: null,
    role,
    invited_by: user.id,
    expires_at: expiresAt,
  };
  const { data, error } = await supabase.from('invitations').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Crea una invitación de **promoción** (IDENT-1 paso 6): un link de un solo uso dirigido a un
 * placeholder (`member_id`). Al aceptarlo, esa persona pasa a ser el usuario real de ese placeholder,
 * conservando toda su historia (ver `accept_invitation`). RLS exige owner/admin. El admin copia el
 * link y se lo pasa a la persona.
 */
export async function createPlaceholderInvite(
  workspaceId: string,
  memberId: string,
  role: MemberRole,
): Promise<Invitation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const expiresAt = new Date(Date.now() + INVITE_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const payload: TablesInsert<'invitations'> = {
    workspace_id: workspaceId,
    email: null,
    role,
    invited_by: user.id,
    member_id: memberId,
    expires_at: expiresAt,
  };
  const { data, error } = await supabase.from('invitations').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Revoca una invitación (link o email): deja de ser aceptable. RLS exige owner/admin. */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) throw error;
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
    memberName: row.member_name,
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
