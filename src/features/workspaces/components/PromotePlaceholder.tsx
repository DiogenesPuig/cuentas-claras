import { useState } from 'react';
import { useCreatePlaceholderInvite } from '../hooks';

function buildInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * Genera un link de **promoción** (IDENT-1 paso 6) para una persona del grupo sin cuenta (placeholder):
 * al aceptarlo, esa persona pasa a ser un usuario real conservando toda su historia. El admin copia el
 * link y se lo manda. Solo owner/admin (lo gatea `MemberList`).
 */
export function PromotePlaceholder({
  workspaceId,
  memberId,
  memberName,
}: {
  workspaceId: string;
  memberId: string;
  memberName: string;
}) {
  const create = useCreatePlaceholderInvite(workspaceId);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    try {
      const inv = await create.mutateAsync({ memberId, role: 'member' });
      setLink(buildInviteUrl(inv.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el link.');
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      {link ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Link para invitar a ${memberName}`}
            className="w-full max-w-xs rounded border border-input bg-muted px-2 py-1 text-xs"
          />
          <button type="button" onClick={copy} className="text-xs font-medium text-primary hover:underline">
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={create.isPending}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {create.isPending ? 'Generando…' : 'Invitar a que se una a la app'}
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        Al aceptar, {memberName} tendrá su cuenta conservando todo su historial.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
