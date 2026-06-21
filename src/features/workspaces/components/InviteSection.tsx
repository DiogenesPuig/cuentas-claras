import { useState } from 'react';
import { useCreateInvitation, useInvitations, useMyRole } from '../hooks';
import type { MemberRole } from '../api';
import type { InviteFormInput } from '../schema';
import { InviteForm } from './InviteForm';
import { InviteLink } from './InviteLink';

const CAN_INVITE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

interface InviteSectionProps {
  workspaceId: string;
}

/** Invitar miembros (email + rol) y ver/copiar el link de las invitaciones pendientes. Solo owner/admin. */
export function InviteSection({ workspaceId }: InviteSectionProps) {
  const { data: myRole } = useMyRole(workspaceId);
  const { data: invitations, isLoading } = useInvitations(workspaceId);
  const createInvitation = useCreateInvitation(workspaceId);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Invitar</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <InviteForm onSubmit={handleSubmit} isSubmitting={createInvitation.isPending} />

      {!isLoading && invitations && invitations.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invitations.map((invitation) => (
            <InviteLink key={invitation.id} invitation={invitation} />
          ))}
        </ul>
      )}
    </div>
  );
}
