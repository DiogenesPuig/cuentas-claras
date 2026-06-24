import { useState } from 'react';
import {
  useCreateInvitation,
  useCreateInviteLink,
  useInvitations,
  useMyRole,
  useRevokeInvitation,
} from '../hooks';
import type { MemberRole } from '../api';
import { type AssignableRole, type InviteFormInput } from '../schema';
import { InviteForm } from './InviteForm';
import { InviteLink } from './InviteLink';
import { RoleSelect } from './RoleSelect';

const CAN_INVITE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

interface InviteSectionProps {
  workspaceId: string;
}

/** Invitar miembros: por email (un solo uso) o por link genérico reutilizable. Solo owner/admin. */
export function InviteSection({ workspaceId }: InviteSectionProps) {
  const { data: myRole } = useMyRole(workspaceId);
  const { data: invitations, isLoading } = useInvitations(workspaceId);
  const createInvitation = useCreateInvitation(workspaceId);
  const createInviteLink = useCreateInviteLink(workspaceId);
  const revokeInvitation = useRevokeInvitation(workspaceId);
  const [error, setError] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState<AssignableRole>('member');

  const canInvite = myRole !== null && myRole !== undefined && CAN_INVITE_ROLES.includes(myRole);

  if (!canInvite) return null;

  async function handleSubmit(input: InviteFormInput) {
    setError(null);
    try {
      await createInvitation.mutateAsync(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la invitación.');
    }
  }

  async function handleGenerateLink() {
    setError(null);
    try {
      await createInviteLink.mutateAsync(linkRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el link.');
    }
  }

  async function handleRevoke(invitationId: string) {
    setError(null);
    try {
      await revokeInvitation.mutateAsync(invitationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar la invitación.');
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Invitar</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <InviteForm onSubmit={handleSubmit} isSubmitting={createInvitation.isPending} />

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm font-medium">Link de invitación</p>
        <p className="text-xs text-muted-foreground">
          Cualquiera con el link se une (reutilizable, vence a las 48 hs).
        </p>
        <div className="flex items-center gap-2">
          <RoleSelect value={linkRole} onChange={setLinkRole} disabled={createInviteLink.isPending} />
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={createInviteLink.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Generar link
          </button>
        </div>
      </div>

      {!isLoading && invitations && invitations.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invitations.map((invitation) => (
            <InviteLink
              key={invitation.id}
              invitation={invitation}
              onRevoke={handleRevoke}
              isRevoking={revokeInvitation.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
