import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { useDeleteWorkspace, useMyRole, useWorkspace } from '../hooks';

/**
 * Zona de peligro (MEJ-15): elimina el grupo y TODO lo colgado (miembros, medios, movimientos,
 * categorías, invitaciones, apodos). Solo el **owner** (RLS `ws_delete`). Confirmación fuerte: hay que
 * escribir el nombre exacto del grupo. Tras borrar, reasigna el workspace activo a otro grupo (o lo
 * limpia → onboarding si no queda ninguno).
 */
export function DeleteWorkspace({ workspaceId }: { workspaceId: string }) {
  const { data: role } = useMyRole(workspaceId);
  const { data: workspace } = useWorkspace(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();
  const clearWorkspace = useActiveWorkspace((s) => s.clearWorkspace);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Solo el owner puede borrar el grupo (además la RLS lo garantiza).
  if (role !== 'owner') return null;

  const name = workspace?.name ?? '';
  const confirmed = name !== '' && typed.trim() === name;

  async function handleDelete() {
    if (!confirmed) return;
    setError(null);
    try {
      await deleteWorkspace.mutateAsync(workspaceId);
      // Ir a la vista de "Tus grupos" (`/` → HomeGate): con >1 grupo elige; con 1 entra directo; con
      // 0 va a onboarding (RequireWorkspace). Se limpia el activo para no quedar con el grupo borrado.
      clearWorkspace();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el grupo.');
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Zona de peligro
      </h3>
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
        {!open ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Eliminar este grupo borra <strong>todos</strong> sus movimientos, medios, categorías y
              miembros. No se puede deshacer.
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Eliminar grupo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Para confirmar, escribí el nombre del grupo: <strong>{name}</strong>
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              aria-label="Nombre del grupo para confirmar"
              className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={!confirmed || deleteWorkspace.isPending}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {deleteWorkspace.isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTyped('');
                  setError(null);
                }}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
