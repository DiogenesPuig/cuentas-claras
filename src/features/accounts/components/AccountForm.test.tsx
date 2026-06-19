import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountForm } from './AccountForm';

describe('AccountForm', () => {
  it('requiere el nombre antes de enviar', async () => {
    const onSubmit = vi.fn();
    render(<AccountForm members={[]} parentOptions={[]} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Crear medio' }));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exige elegir un miembro cuando el holder es "Miembro de la app"', async () => {
    const onSubmit = vi.fn();
    const members = [{ id: 'member-1', name: 'Pepito' }];
    render(<AccountForm members={members} parentOptions={[]} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Visa Nación');
    await userEvent.click(screen.getByLabelText('Miembro de la app'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear medio' }));

    await waitFor(() => {
      expect(screen.getByText('Elegí un miembro.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('setea owner_member_id cuando el holder es un miembro', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const members = [{ id: 'member-1', name: 'Pepito' }];
    render(<AccountForm members={members} parentOptions={[]} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Visa Nación');
    await userEvent.click(screen.getByLabelText('Miembro de la app'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Miembro' }), 'member-1');
    await userEvent.click(screen.getByRole('button', { name: 'Crear medio' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ ownerMemberId: 'member-1', holderName: 'Pepito' }),
      );
    });
  });

  it('exige elegir la tarjeta titular cuando es una extensión', async () => {
    const onSubmit = vi.fn();
    const members = [{ id: 'member-1', name: 'Pepito' }];
    render(<AccountForm members={members} parentOptions={[]} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Visa Nación extensión');
    await userEvent.click(screen.getByLabelText('Otra persona'));
    await userEvent.type(screen.getByPlaceholderText('Nombre del titular'), 'Pepito');
    await userEvent.click(screen.getByLabelText('Es una extensión'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear medio' }));

    await waitFor(() => {
      expect(screen.getByText('Elegí la tarjeta titular.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
