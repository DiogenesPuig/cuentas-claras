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
    <div className="mt-2 space-y-1 border-t border-border pt-2">
      <p className="text-xs text-muted-foreground">
        Otros nombres de esta persona (para no duplicar el medio al importar transferencias):
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {aliases.map((alias) => (
          <span
            key={alias}
            className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground"
          >
            {alias}
            <button
              type="button"
              onClick={() => void save(aliases.filter((a) => a !== alias))}
              disabled={update.isPending}
              aria-label={`Quitar ${alias}`}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
        {aliases.length === 0 && <span className="text-xs text-muted-foreground">Sin alias.</span>}
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
          className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
