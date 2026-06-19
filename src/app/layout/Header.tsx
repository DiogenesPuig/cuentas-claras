import { LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';

/** Cabecera de la app: selector de workspace, selector de mes y salir. */
export function Header() {
  const { signOut } = useAuth();
  const clearWorkspace = useActiveWorkspace((state) => state.clearWorkspace);

  async function handleSignOut() {
    clearWorkspace();
    await signOut();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <WorkspaceSwitcher />
        <button
          type="button"
          aria-label="Cerrar sesión"
          onClick={handleSignOut}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="flex items-center justify-end px-4 pb-2">
        <MonthSwitcher />
      </div>
    </header>
  );
}
