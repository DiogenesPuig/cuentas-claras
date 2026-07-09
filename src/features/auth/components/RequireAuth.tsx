import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { savePendingInvite } from '@/lib/pending-invite';
import { useAuth } from '../context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!session) {
    // Si venía de una invitación, la guardamos para retomarla tras el login/OAuth (BUG-16):
    // el OAuth de Google pierde el `state.from` en el redirect de página completa.
    if (location.pathname.startsWith('/invite/')) {
      savePendingInvite(location.pathname);
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
