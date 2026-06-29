import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WelcomeGreeting } from './WelcomeGreeting';

// Estado mutable para variar el perfil/email por test (referencias estables por render).
const { state } = vi.hoisted(() => ({
  state: { profile: { name: 'diogepuig' } as { name: string } | null, email: 'dioge@example.com' as string | undefined },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth');
  return {
    ...actual,
    useAuth: () => ({ user: { email: state.email } }),
    useMyProfile: () => ({ data: state.profile, isLoading: false }),
  };
});

describe('WelcomeGreeting', () => {
  it('muestra el nombre del perfil', () => {
    state.profile = { name: 'Dioge' };
    state.email = 'dioge@example.com';
    render(<WelcomeGreeting />);
    expect(screen.getByText('Dioge')).toBeInTheDocument();
  });

  it('cae a la parte local del email si no hay nombre de perfil', () => {
    state.profile = null;
    state.email = 'dioge@example.com';
    render(<WelcomeGreeting />);
    expect(screen.getByText('dioge')).toBeInTheDocument();
  });

  it('no renderiza nada si no hay nombre ni email', () => {
    state.profile = null;
    state.email = undefined;
    const { container } = render(<WelcomeGreeting />);
    expect(container).toBeEmptyDOMElement();
  });
});
