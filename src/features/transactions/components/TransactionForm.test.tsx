import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Account } from '@/features/accounts';
import { TransactionForm } from './TransactionForm';

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    workspace_id: 'ws-1',
    name: 'Cuenta',
    bank: null,
    network: null,
    type: 'bank_account',
    currency: 'ARS',
    last4: null,
    holder_name: 'Titular',
    owner_member_id: null,
    is_extension: false,
    is_archived: false,
    parent_account_id: null,
    billing_close_day: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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

  it('usa la fecha de hoy por defecto en formato DD/MM/AAAA', () => {
    render(<TransactionForm categories={[]} accounts={[]} onSubmit={vi.fn()} />);

    const [y, m, d] = new Date().toISOString().slice(0, 10).split('-');
    expect(screen.getByLabelText('Fecha')).toHaveValue(`${d}/${m}/${y}`);
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

  it('precarga monto/fecha/comercio desde el OCR del comprobante (FR-14)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onExtractReceipt = vi.fn().mockResolvedValue({
      amount: 2350.5,
      currency: 'ARS',
      date: '2026-05-21',
      merchant: 'Supermercado La Economia',
      confidence: 0.9,
    });
    render(
      <TransactionForm
        categories={[]}
        accounts={[]}
        onSubmit={onSubmit}
        onExtractReceipt={onExtractReceipt}
      />,
    );

    const file = new File(['x'], 'ticket.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Comprobante (opcional)'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Monto')).toHaveValue(2350.5);
    });
    expect(screen.getByLabelText('Motivo (opcional)')).toHaveValue('Supermercado La Economia');
    expect(screen.getByLabelText('Fecha')).toHaveValue('21/05/2026');

    // Al guardar, el alta queda marcada como origen OCR.
    await userEvent.click(screen.getByRole('button', { name: 'Crear movimiento' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2350.5, source: 'ocr' }),
        file,
      );
    });
  });

  it('avisa y no precarga si el OCR no extrae datos', async () => {
    const onExtractReceipt = vi.fn().mockResolvedValue({
      amount: null,
      currency: null,
      date: null,
      merchant: null,
      confidence: 0,
    });
    render(
      <TransactionForm
        categories={[]}
        accounts={[]}
        onSubmit={vi.fn()}
        onExtractReceipt={onExtractReceipt}
      />,
    );

    const file = new File(['x'], 'borroso.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Comprobante (opcional)'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));

    await waitFor(() => {
      expect(screen.getByText(/No se pudieron extraer datos/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Monto')).toHaveValue(null);
  });

  it('en una transferencia, autoasocia el medio del origen si ya existe (gasto)', async () => {
    const account = makeAccount({
      id: 'acc-juan',
      bank: 'Banco Patagonia',
      holder_name: 'Juan Pérez',
    });
    const onExtractReceipt = vi.fn().mockResolvedValue({
      amount: 1000,
      currency: 'ARS',
      date: '2026-05-21',
      merchant: null,
      confidence: 0.9,
      origin_holder: 'Juan Pérez',
      origin_bank: 'Banco Patagonia',
      dest_holder: 'María Gómez',
      dest_bank: 'Banco Galicia',
    });
    render(
      <TransactionForm
        categories={[]}
        accounts={[account]}
        onSubmit={vi.fn()}
        onExtractReceipt={onExtractReceipt}
      />,
    );

    const file = new File(['x'], 'transferencia.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Comprobante (opcional)'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Medio (opcional)')).toHaveValue('acc-juan');
    });
    expect(screen.getByText(/Transferencia con Juan Pérez/)).toBeInTheDocument();
  });

  it('en una transferencia, ofrece crear el medio del destino si no existe (ingreso)', async () => {
    const onExtractReceipt = vi.fn().mockResolvedValue({
      amount: 1000,
      currency: 'ARS',
      date: '2026-05-21',
      merchant: null,
      confidence: 0.9,
      origin_holder: 'Juan Pérez',
      origin_bank: 'Banco Patagonia',
      dest_holder: 'María Gómez',
      dest_bank: 'Banco Galicia',
    });
    renderWithQueryClient(
      <TransactionForm
        categories={[]}
        accounts={[]}
        onSubmit={vi.fn()}
        onExtractReceipt={onExtractReceipt}
        workspaceId="ws-1"
        members={[]}
      />,
    );

    await userEvent.click(screen.getByLabelText('Ingreso'));
    const file = new File(['x'], 'transferencia.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Comprobante (opcional)'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));

    await waitFor(() => {
      expect(screen.getByText(/Transferencia con María Gómez/)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Crear medio' }));

    await waitFor(() => {
      expect(screen.getByText('Crear medio para María Gómez')).toBeInTheDocument();
    });
  });
});
