import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getPendingInvite } from '@/lib/pending-invite';
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
    // Si el usuario venía de una invitación (BUG-16), retomarla en vez de mandarlo a crear un grupo.
    // `InviteAcceptPage` limpia el pendiente al montar, así que no hay loop.
    const pendingInvite = getPendingInvite();
    if (pendingInvite) {
      return <Navigate to={pendingInvite} replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
