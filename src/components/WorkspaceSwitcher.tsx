import { ChevronDown } from 'lucide-react';
import { useMyWorkspaces } from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/**
 * Selector del workspace activo. Lista los grupos del usuario y cambia el
 * activo en el store (lo que refresca los datos dependientes del grupo).
 */
export function WorkspaceSwitcher() {
  const { data: workspaces, isLoading } = useMyWorkspaces();
  const { workspaceId, setWorkspace } = useActiveWorkspace();

  if (isLoading) {
    return <span className="text-sm text-muted-foreground">Cargando…</span>;
  }

  if (!workspaces || workspaces.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label="Grupo activo"
        value={workspaceId ?? ''}
        onChange={(event) => setWorkspace(event.target.value)}
        className="appearance-none rounded-md bg-transparent py-1 pl-2 pr-7 text-base font-semibold text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
