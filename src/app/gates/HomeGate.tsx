import { Navigate } from 'react-router-dom';
import { useMyWorkspaces } from '@/features/workspaces';
import { GroupsLanding } from './GroupsLanding';

/**
 * Inicio (`/`): decide qué mostrar según cuántos grupos tiene el usuario.
 * - 0 grupos → lo maneja `RequireWorkspace` (redirige a `/onboarding`), no se llega acá.
 * - 1 grupo  → va directo a Reportes (el contenido más importante).
 * - >1 grupos → landing para elegir grupo (`GroupsLanding`).
 */
export function HomeGate() {
  const { data: workspaces, isLoading } = useMyWorkspaces();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (workspaces && workspaces.length === 1) {
    return <Navigate to="/reportes" replace />;
  }

  return <GroupsLanding />;
}
