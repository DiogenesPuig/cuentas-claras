import { useAuth, useMyProfile } from '@/features/auth';

interface WelcomeGreetingProps {
  className?: string;
}

/**
 * Saludo "¡Hola, <nombre>!" (MEJ-3). Usa el nombre del perfil (MEJ-7); si todavía no
 * hay, cae a la parte local del email. Si no hay ninguno, no renderiza nada.
 */
export function WelcomeGreeting({ className }: WelcomeGreetingProps) {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const name = profile?.name?.trim() || user?.email?.split('@')[0] || '';
  if (!name) return null;
  return (
    <span className={className}>
      ¡Hola, <span className="font-medium text-foreground">{name}</span>!
    </span>
  );
}
