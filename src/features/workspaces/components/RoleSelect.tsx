import { ASSIGNABLE_ROLES, type AssignableRole } from '../schema';

const ROLE_LABELS: Record<AssignableRole, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

interface RoleSelectProps {
  id?: string;
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  disabled?: boolean;
}

/** Selector de rol (sin `owner`: ese rol no se otorga desde la UI). */
export function RoleSelect({ id, value, onChange, disabled }: RoleSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as AssignableRole)}
      className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-50"
    >
      {ASSIGNABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}
