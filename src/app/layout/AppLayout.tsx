import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useMyWorkspaces } from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { Header } from './Header';
import { TabBar } from './TabBar';

/**
 * Mantiene el workspace activo consistente con los grupos del usuario:
 * lo inicializa con el primero si no hay ninguno elegido, y lo corrige si el
 * persistido ya no pertenece al usuario.
 */
function useEnsureActiveWorkspace() {
  const { data: workspaces } = useMyWorkspaces();
  const { workspaceId, setWorkspace } = useActiveWorkspace();

  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;
    const isValid = workspaceId && workspaces.some((ws) => ws.id === workspaceId);
    if (!isValid) setWorkspace(workspaces[0].id);
  }, [workspaces, workspaceId, setWorkspace]);
}

/** Shell de la app autenticada: Header + contenido (`<Outlet/>`) + TabBar/sidebar. */
export function AppLayout() {
  useEnsureActiveWorkspace();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <TabBar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-4 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
