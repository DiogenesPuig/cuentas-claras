import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { displayPersonaLabel, useAliases, useDeleteAlias, useUpsertAlias } from '@/features/aliases';
import { useMembers, useMyRole, useRemoveMember, useUpdateMemberRole } from '../hooks';
import type { MemberRole } from '../api';
import type { AssignableRole } from '../schema';
import { MemberAliasesEditor } from './MemberAliasesEditor';
import { RoleSelect } from './RoleSelect';

const CAN_MANAGE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

/** Clave de apodo (MEJ-8) de un miembro: igual a la persona de los reportes (`member:<id>`). */
function personaKeyOf(memberId: string): string {
  return `member:${memberId}`;
}

interface MemberListProps {
  workspaceId: string;
}

/**
 * Lista de miembros del workspace: nombre, avatar y rol (nunca el teléfono,
 * viene de `member_directory`). Owner/admin pueden cambiar el rol de los
 * demás y quitarlos; el `owner` no se edita ni se quita desde acá.
 */
export function MemberList({ workspaceId }: MemberListProps) {
  const { data: members, isLoading } = useMembers(workspaceId);
  const { data: myRole } = useMyRole(workspaceId);
  const updateRole = useUpdateMemberRole(workspaceId);
  const removeMember = useRemoveMember(workspaceId);

  // Apodos privados (MEJ-8): renombrar a un miembro solo para mí. Misma clave que reportes.
  const { data: aliasData } = useAliases(workspaceId);
  const aliases = aliasData ?? {};
  const upsertAlias = useUpsertAlias(workspaceId);
  const deleteAlias = useDeleteAlias(workspaceId);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const canManage = myRole !== null && myRole !== undefined && CAN_MANAGE_ROLES.includes(myRole);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando miembros…</p>;
  }

  function handleRemove(memberId: string, name: string) {
    if (!window.confirm(`¿Quitar a ${name} del grupo?`)) return;
    removeMember.mutate(memberId);
  }

  function startEdit(key: string, current: string) {
    setEditingKey(key);
    setDraft(current);
  }

  function commitAlias(key: string) {
    const value = draft.trim();
    if (value) upsertAlias.mutate({ personaKey: key, alias: value });
    else deleteAlias.mutate(key);
    setEditingKey(null);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Miembros ({members?.length ?? 0})
      </h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {(members ?? []).map((member) => {
          const key = personaKeyOf(member.id);
          const display = displayPersonaLabel(key, member.name, aliases);
          const isEditing = editingKey === key;
          return (
          <li key={member.id} className="px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" aria-hidden />
              )}
              {isEditing ? (
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitAlias(key);
                      if (e.key === 'Escape') setEditingKey(null);
                    }}
                    autoFocus
                    aria-label={`Apodo para ${member.name}`}
                    placeholder={member.name}
                    className="w-32 rounded border border-input bg-background px-1.5 py-0.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => commitAlias(key)}
                    aria-label="Guardar apodo"
                    className="text-primary hover:opacity-80"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingKey(null)}
                    aria-label="Cancelar"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {display}
                  <button
                    type="button"
                    onClick={() => startEdit(key, display === member.name ? '' : display)}
                    aria-label={`Ponerle un apodo a ${member.name}`}
                    title="Apodo (solo lo ves vos)"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              )}
            </div>

            {member.role === 'owner' || !canManage ? (
              <span className="text-xs text-muted-foreground">
                {member.role === 'owner' ? 'Owner' : member.role}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <RoleSelect
                  value={member.role as AssignableRole}
                  onChange={(role) => updateRole.mutate({ memberId: member.id, role })}
                  disabled={updateRole.isPending}
                />
                <button
                  type="button"
                  onClick={() => handleRemove(member.id, member.name)}
                  disabled={removeMember.isPending}
                  className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            )}
            </div>
            {canManage && (
              <div className="mt-2 border-t border-dashed border-border pt-2">
                <MemberAliasesEditor
                  memberId={member.id}
                  memberName={member.name}
                  aliases={member.aliases}
                  workspaceId={workspaceId}
                />
              </div>
            )}
          </li>
          );
        })}
        {members?.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Sin miembros.</li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        Solo se ve el nombre, nunca el teléfono · roles: owner/admin/member/viewer · el ✏️ pone un
        apodo privado (solo lo ves vos) · "otros nombres" ayuda a reconocer a la persona al importar
        transferencias (lo ve todo el grupo).
      </p>
    </div>
  );
}
