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
}

/** Fila de una invitación con su link copiable (no hay envío de email configurado). */
export function InviteLink({ invitation }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const isExpired = invitation.status === 'pending' && new Date(invitation.expires_at) < new Date();

  async function handleCopy() {
    await navigator.clipboard.writeText(buildInviteUrl(invitation.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <div>
        <p>{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          {isExpired ? 'Vencida' : STATUS_LABELS[invitation.status]} · rol {invitation.role}
        </p>
      </div>
      {invitation.status === 'pending' && !isExpired && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium text-primary hover:underline"
        >
          {copied ? 'Copiado' : 'Copiar link'}
        </button>
      )}
    </li>
  );
}
