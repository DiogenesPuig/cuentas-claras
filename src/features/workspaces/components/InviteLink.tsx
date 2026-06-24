import { useState } from 'react';
import type { Invitation } from '../api';

const STATUS_LABELS: Record<Invitation['status'], string> = {
  pending: 'Invitación pendiente',
  accepted: 'Aceptada',
  revoked: 'Revocada',
  expired: 'Vencida',
};

function buildInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

interface InviteLinkProps {
  invitation: Invitation;
  onRevoke?: (invitationId: string) => void;
  isRevoking?: boolean;
}

/** Fila de una invitación con su link copiable (no hay envío de email configurado). */
export function InviteLink({ invitation, onRevoke, isRevoking }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const isExpired = invitation.status === 'pending' && new Date(invitation.expires_at) < new Date();
  const isActive = invitation.status === 'pending' && !isExpired;
  // `email = null` ⇒ link genérico reutilizable (migración 0012).
  const isGenericLink = invitation.email === null;

  async function handleCopy() {
    await navigator.clipboard.writeText(buildInviteUrl(invitation.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <div>
        <p>{isGenericLink ? 'Link de invitación' : invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          {isExpired ? 'Vencida' : STATUS_LABELS[invitation.status]} · rol {invitation.role}
          {isGenericLink && ' · reutilizable'}
        </p>
      </div>
      {isActive && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs font-medium text-primary hover:underline"
          >
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
          {onRevoke && (
            <button
              type="button"
              onClick={() => onRevoke(invitation.id)}
              disabled={isRevoking}
              className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
            >
              Revocar
            </button>
          )}
        </div>
      )}
    </li>
  );
}
