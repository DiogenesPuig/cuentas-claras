import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from './OnboardingPage';

const mutateAsync = vi.fn();

// El barrel real de workspaces importa `@/lib/supabase`; lo stubbeamos para que
// no falle por falta de variables de entorno al cargar el módulo.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/features/workspaces', async () => {
  const actual = await vi.importActual<typeof import('@/features/workspaces')>(
    '@/features/workspaces',
  );
  return {
    ...actual,
    useMyWorkspaces: () => ({ data: [], isLoading: false }),
    useCompleteOnboarding: () => ({ mutateAsync, isPending: false }),
  };
});

describe('OnboardingPage', () => {
  it('valida nombre y grupo obligatorios al enviar vacío', async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));

    await waitFor(() => {
      expect(screen.getByText('Tu nombre es obligatorio')).toBeInTheDocument();
      expect(screen.getByText('El nombre del grupo es obligatorio')).toBeInTheDocument();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('ofrece ARS como moneda base por defecto', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    const select = screen.getByLabelText('Moneda base') as HTMLSelectElement;
    expect(select.value).toBe('ARS');
  });
});
