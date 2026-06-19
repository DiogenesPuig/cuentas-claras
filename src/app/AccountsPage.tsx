import { AccountList } from '@/features/accounts';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Pantalla `/medios`: gestión de tarjetas/medios de pago del workspace activo. */
export function AccountsPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);

  if (!workspaceId) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tarjetas y medios</h1>
      <AccountList workspaceId={workspaceId} />
    </div>
  );
}
