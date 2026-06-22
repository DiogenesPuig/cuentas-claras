import { StatementImport } from '@/features/imports';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Pantalla `/importar`: subir un resumen de tarjeta, revisar y confirmar (FR-16). */
export function ImportPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);
  if (!workspaceId) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Importar resumen</h1>
        <p className="text-sm text-muted-foreground">
          Subí el PDF del resumen de tarjeta (Banco Patagonia Visa/Master), revisá los movimientos
          detectados y confirmalos en bloque.
        </p>
      </div>
      <StatementImport workspaceId={workspaceId} />
    </div>
  );
}
