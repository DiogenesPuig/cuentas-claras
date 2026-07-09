import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAcceptInvitation, useInvitationPreview } from '@/features/workspaces';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { clearPendingInvite } from '@/lib/pending-invite';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

/** Pantalla `/invite/:token`: aceptar una invitación a un workspace (C15). */
export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setWorkspace = useActiveWorkspace((state) => state.setWorkspace);
  const { data: preview, isLoading, isError } = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation();
  const [error, setError] = useState<string | null>(null);

  // Ya llegamos a la pantalla de invitación: el redirect pendiente (BUG-16) cumplió su función.
  useEffect(() => clearPendingInvite(), []);

  async function handleAccept() {
    if (!token) return;
    setError(null);
    try {
      const workspaceId = await acceptInvitation.mutateAsync(token);
      setWorkspace(workspaceId);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación.');
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (isError || !preview || !preview.isUsable) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-bold">Invitación no disponible</h1>
        <p className="text-sm text-muted-foreground">
          El link venció o ya no es válido. Pedile a quien te invitó que te mande uno nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">Te invitaron a {preview.workspaceName}</h1>
      <p className="text-sm text-muted-foreground">
        Vas a unirte como <strong>{ROLE_LABELS[preview.role] ?? preview.role}</strong>.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={handleAccept}
        disabled={acceptInvitation.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Aceptar invitación
      </button>
    </div>
  );
}
