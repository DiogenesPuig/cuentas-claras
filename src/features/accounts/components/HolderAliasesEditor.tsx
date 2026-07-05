import { useState } from 'react';
import { useUpdateHolderAliases } from '../hooks';
import type { Account } from '../api';

/**
 * Gestión de los nombres alternativos (alias) del titular de un medio `'transfer'` (MEJ-4).
 * Sirven para que futuros comprobantes/importaciones con ese nombre resuelvan a este medio en vez
 * de crear un duplicado. NO fusiona movimientos ya cargados; solo afecta el matching futuro.
 */
export function HolderAliasesEditor({
  account,
  workspaceId,
}: {
  account: Account;
  workspaceId: string;
}) {
  const update = useUpdateHolderAliases(workspaceId);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const aliases = account.holder_aliases;

  async function save(next: string[]) {
    setError(null);
    try {
      await update.mutateAsync({ id: account.id, aliases: next });
      setValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  }

  function addAlias() {
    if (!value.trim()) return;
    void save([...aliases, value]);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Otros nombres de esta persona{' '}
        <span className="font-normal">(para no duplicar el medio al importar transferencias)</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {aliases.map((alias) => (
          <span
            key={alias}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-0.5 pl-2.5 pr-1 text-xs shadow-sm"
          >
            {alias}
            <button
              type="button"
              onClick={() => void save(aliases.filter((a) => a !== alias))}
              disabled={update.isPending}
              aria-label={`Quitar ${alias}`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
        {aliases.length === 0 && (
          <span className="text-xs italic text-muted-foreground">Sin nombres alternativos.</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addAlias();
            }
          }}
          placeholder="Ej: Pepito"
          aria-label={`Agregar nombre alternativo a ${account.holder_name}`}
          className="w-40 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={addAlias}
          disabled={update.isPending || !value.trim()}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
