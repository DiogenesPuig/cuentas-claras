import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryForm } from './CategoryForm';

describe('CategoryForm', () => {
  it('requiere el nombre antes de enviar', async () => {
    const onSubmit = vi.fn();
    render(<CategoryForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía un kind válido por defecto (gasto)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CategoryForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Mascotas');
    await userEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Mascotas',
        kind: 'expense',
        icon: null,
        color: null,
      });
    });
  });
});
