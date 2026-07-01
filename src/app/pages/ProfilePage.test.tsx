import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const mutateAsync = vi.fn();

// El barrel real de auth importa `@/lib/supabase`; lo stubbeamos para que no falle
// por falta de variables de entorno al cargar el módulo.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth');
  // Referencias ESTABLES: si el hook devolviera un objeto nuevo en cada render, el
  // `useEffect([profile])` de ProfilePage se dispararía en loop (reset → re-render → …).
  const profile = { id: 'u1', name: 'diogepuig' };
  const user = { email: 'dioge@example.com' };
  return {
    ...actual,
    useAuth: () => ({ user }),
    useMyProfile: () => ({ data: profile, isLoading: false }),
    useUpdateMyProfile: () => ({ mutateAsync, isPending: false }),
  };
});

describe('ProfilePage', () => {
  it('precarga el nombre actual del perfil', async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByLabelText('Tu nombre') as HTMLInputElement).value).toBe('diogepuig');
    });
  });

  it('no guarda si el nombre queda vacío', async () => {
    render(<ProfilePage />);
    const input = await screen.findByLabelText('Tu nombre');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(screen.getByText('Tu nombre es obligatorio')).toBeInTheDocument();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
