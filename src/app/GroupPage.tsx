import { InviteSection, MemberList, WorkspaceSettings } from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Pantalla `/grupo`: miembros, invitaciones y configuración del workspace activo (C15). */
export function GroupPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);

  if (!workspaceId) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Grupo</h1>
      <MemberList workspaceId={workspaceId} />
      <InviteSection workspaceId={workspaceId} />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Configuración</h3>
        <WorkspaceSettings workspaceId={workspaceId} />
      </div>
    </div>
  );
}
