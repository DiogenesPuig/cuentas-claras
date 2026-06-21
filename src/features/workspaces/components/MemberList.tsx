import { useMembers, useMyRole, useRemoveMember, useUpdateMemberRole } from '../hooks';
import type { MemberRole } from '../api';
import type { AssignableRole } from '../schema';
import { RoleSelect } from './RoleSelect';

const CAN_MANAGE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

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

  const canManage = myRole !== null && myRole !== undefined && CAN_MANAGE_ROLES.includes(myRole);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando miembros…</p>;
  }

  function handleRemove(memberId: string, name: string) {
    if (!window.confirm(`¿Quitar a ${name} del grupo?`)) return;
    removeMember.mutate(memberId);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Miembros ({members?.length ?? 0})
      </h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {(members ?? []).map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
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
              <span>{member.name}</span>
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
          </li>
        ))}
        {members?.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Sin miembros.</li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        Solo se ve el nombre, nunca el teléfono · roles: owner/admin/member/viewer.
      </p>
    </div>
  );
}
