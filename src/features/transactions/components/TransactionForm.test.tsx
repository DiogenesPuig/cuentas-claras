import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransactionForm } from './TransactionForm';

describe('TransactionForm', () => {
  it('exige un monto mayor a 0 antes de enviar', async () => {
    const onSubmit = vi.fn();
    render(<TransactionForm categories={[]} accounts={[]} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Crear movimiento' }));

    await waitFor(() => {
      expect(screen.getByText('El monto debe ser mayor a 0')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('usa la fecha de hoy por defecto', () => {
    render(<TransactionForm categories={[]} accounts={[]} onSubmit={vi.fn()} />);

    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText('Fecha')).toHaveValue(today);
  });

  it('crea un gasto con monto y moneda válidos', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TransactionForm categories={[]} accounts={[]} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Monto'), '1500');
    await userEvent.type(screen.getByLabelText('Motivo (opcional)'), 'Supermercado');
    await userEvent.click(screen.getByRole('button', { name: 'Crear movimiento' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 1500,
          currency: 'ARS',
          description: 'Supermercado',
        }),
        null,
      );
    });
  });

  it('exige una moneda de 3 letras', async () => {
    const onSubmit = vi.fn();
    render(<TransactionForm categories={[]} accounts={[]} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Monto'), '100');
    await userEvent.clear(screen.getByLabelText('Moneda'));
    await userEvent.type(screen.getByLabelText('Moneda'), 'AR');
    await userEvent.click(screen.getByRole('button', { name: 'Crear movimiento' }));

    await waitFor(() => {
      expect(screen.getByText('Usá el código de 3 letras (ej. ARS)')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
