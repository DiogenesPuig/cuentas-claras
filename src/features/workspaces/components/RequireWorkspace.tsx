import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMyWorkspaces } from '../hooks';

/**
 * Guard para rutas que requieren al menos un workspace.
 * Si el usuario no pertenece a ninguno, lo lleva al onboarding.
 */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { data: workspaces, isLoading, isError, error } = useMyWorkspaces();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-destructive">
        {error instanceof Error ? error.message : 'No se pudieron cargar tus grupos.'}
      </div>
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
