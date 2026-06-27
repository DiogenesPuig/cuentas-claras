import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Users } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { CreateWorkspaceDialog, useMyWorkspaces, type Workspace } from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/**
 * Pantalla de inicio cuando el usuario tiene MÁS DE UN grupo: elige a cuál entrar.
 * No muestra la barra de secciones (esa aparece recién dentro de un grupo). Con un
 * solo grupo no se llega acá (el inicio va directo a Reportes; ver `HomeGate`).
 */
export function GroupsLanding() {
  const { data: workspaces } = useMyWorkspaces();
  const setWorkspace = useActiveWorkspace((state) => state.setWorkspace);
  const clearWorkspace = useActiveWorkspace((state) => state.clearWorkspace);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  function enterGroup(workspace: Workspace) {
    setWorkspace(workspace.id);
    navigate('/reportes');
  }

  async function handleSignOut() {
    clearWorkspace();
    await signOut();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tus grupos</h1>
        <button
          type="button"
          aria-label="Cerrar sesión"
          onClick={handleSignOut}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <p className="text-sm text-muted-foreground">Elegí un grupo para entrar.</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {(workspaces ?? []).map((workspace) => (
          <li key={workspace.id}>
            <button
              type="button"
              onClick={() => enterGroup(workspace)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Users className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{workspace.name}</span>
                <span className="block text-xs text-muted-foreground">{workspace.base_currency}</span>
              </span>
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden />
            <span className="font-medium">Nuevo grupo</span>
          </button>
        </li>
      </ul>

      <CreateWorkspaceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setWorkspace(id);
          navigate('/reportes');
        }}
      />
    </main>
  );
}
