import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  CreateWorkspaceDialog,
  DeleteWorkspace,
  InviteSection,
  MemberList,
  WorkspaceSettings,
} from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Pantalla `/grupo`: crear grupo, miembros, invitaciones y configuración del workspace activo (C15). */
export function GroupPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);
  const setWorkspace = useActiveWorkspace((state) => state.setWorkspace);
  const [creating, setCreating] = useState(false);

  if (!workspaceId) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Grupo</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo grupo
        </button>
      </div>

      <MemberList workspaceId={workspaceId} />
      <InviteSection workspaceId={workspaceId} />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Configuración</h3>
        <WorkspaceSettings workspaceId={workspaceId} />
      </div>

      <DeleteWorkspace workspaceId={workspaceId} />

      <CreateWorkspaceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => setWorkspace(id)}
      />
    </div>
  );
}
