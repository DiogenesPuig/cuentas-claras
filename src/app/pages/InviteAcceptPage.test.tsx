import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InviteAcceptPage } from './InviteAcceptPage';

const mutateAsync = vi.fn();
const setWorkspace = vi.fn();
const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/hooks/useActiveWorkspace', () => ({
  useActiveWorkspace: (selector: (state: { setWorkspace: typeof setWorkspace }) => unknown) =>
    selector({ setWorkspace }),
}));

let previewResult: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
};

vi.mock('@/features/workspaces', () => ({
  useInvitationPreview: () => previewResult,
  useAcceptInvitation: () => ({ mutateAsync, isPending: false }),
}));

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InviteAcceptPage', () => {
  it('muestra la invitación y permite aceptarla cuando el token es válido', async () => {
    previewResult = {
      data: {
        workspaceId: 'ws-1',
        workspaceName: 'Hogar',
        role: 'member',
        email: 'a@a.com',
        isExpired: false,
        isUsable: true,
      },
      isLoading: false,
      isError: false,
    };
    mutateAsync.mockResolvedValue('ws-1');

    renderAt('valid-token');

    expect(screen.getByText('Te invitaron a Hogar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar invitación' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('valid-token');
      expect(setWorkspace).toHaveBeenCalledWith('ws-1');
      expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('rechaza un token vencido/revocado', () => {
    previewResult = {
      data: {
        workspaceId: 'ws-1',
        workspaceName: 'Hogar',
        role: 'member',
        email: 'a@a.com',
        isExpired: true,
        isUsable: false,
      },
      isLoading: false,
      isError: false,
    };

    renderAt('expired-token');

    expect(screen.getByText('Invitación no disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar invitación' })).not.toBeInTheDocument();
  });

  it('rechaza un token inválido (no existe ninguna invitación con ese token)', () => {
    previewResult = { data: null, isLoading: false, isError: false };

    renderAt('does-not-exist');

    expect(screen.getByText('Invitación no disponible')).toBeInTheDocument();
  });
});
