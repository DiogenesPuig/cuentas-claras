import { LayoutGrid, LogOut, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useMyWorkspaces } from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { WelcomeGreeting } from '@/components/WelcomeGreeting';

/** Cabecera de la app: volver a grupos (si hay varios), selector de workspace/mes y salir. */
export function Header() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const clearWorkspace = useActiveWorkspace((state) => state.clearWorkspace);
  const { data: workspaces } = useMyWorkspaces();
  const hasMultipleGroups = (workspaces?.length ?? 0) > 1;

  async function handleSignOut() {
    clearWorkspace();
    await signOut();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-1">
          {hasMultipleGroups && (
            <button
              type="button"
              aria-label="Ver todos los grupos"
              title="Ver todos los grupos"
              onClick={() => navigate('/')}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <LayoutGrid className="h-5 w-5" aria-hidden />
            </button>
          )}
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mi perfil"
            title="Mi perfil"
            onClick={() => navigate('/perfil')}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <UserCog className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Cerrar sesión"
            onClick={handleSignOut}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <LogOut className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-2">
        <WelcomeGreeting className="truncate text-sm text-muted-foreground" />
        <MonthSwitcher />
      </div>
    </header>
  );
}
