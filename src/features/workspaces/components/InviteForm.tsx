import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ASSIGNABLE_ROLES, inviteSchema, type InviteFormInput } from '../schema';

const ROLE_LABELS: Record<InviteFormInput['role'], string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

interface InviteFormProps {
  onSubmit: (input: InviteFormInput) => Promise<void>;
  isSubmitting?: boolean;
}

/** Form para invitar por email + rol. El link copiable se muestra en `InviteLink` tras crearla. */
export function InviteForm({ onSubmit, isSubmitting }: InviteFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  });

  async function handleFormSubmit(values: InviteFormInput) {
    await onSubmit(values);
    reset({ email: '', role: 'member' });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3" noValidate>
      <div className="space-y-1">
        <label htmlFor="invite-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="invite-role" className="text-sm font-medium">
          Rol
        </label>
        <select
          id="invite-role"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('role')}
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Enviar invitación
      </button>
    </form>
  );
}
