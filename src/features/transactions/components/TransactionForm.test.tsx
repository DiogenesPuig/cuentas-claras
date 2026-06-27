import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Account } from '@/features/accounts';
import { TransactionForm } from './TransactionForm';

const toastMock = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const getOrCreateTransferAccountMock = vi.fn();

// Mockeamos el barrel completo (no `vi.importActual`: el barrel re-exporta `api.ts`, que
// importa `lib/supabase` y rompe en CI sin las env vars — ver memoria del barrel). El único
// valor que `TransactionForm.tsx` importa de acá es el hook de F2-11; el resto son tipos
// (se borran en compilación, no hace falta mockearlos).
vi.mock('@/features/accounts', () => ({
  useGetOrCreateTransferAccount: () => ({ mutateAsync: getOrCreateTransferAccountMock }),
}));

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

  it('al reintentar con otro comprobante que no extrae, limpia lo precargado antes (BUG-3)', async () => {
    const onExtractReceipt = vi
      .fn()
      .mockResolvedValueOnce({
        amount: 2350.5,
        currency: 'ARS',
        date: '2026-05-21',
        merchant: 'Supermercado La Economia',
        confidence: 0.9,
      })
      .mockResolvedValueOnce({
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

    const fileInput = screen.getByLabelText('Comprobante (opcional)');
    // 1er comprobante: precarga datos.
    await userEvent.upload(fileInput, new File(['a'], 'ok.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));
    await waitFor(() => expect(screen.getByLabelText('Monto')).toHaveValue(2350.5));

    // 2do comprobante: no extrae → el form NO debe quedar con los datos del 1ro.
    await userEvent.upload(fileInput, new File(['b'], 'malo.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/No se pudieron extraer datos/i));
    });
    expect(screen.getByLabelText('Monto')).toHaveValue(null);
    expect(screen.getByLabelText('Motivo (opcional)')).toHaveValue('');
    const [y, m, d] = new Date().toISOString().slice(0, 10).split('-');
    expect(screen.getByLabelText('Fecha')).toHaveValue(`${d}/${m}/${y}`);
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
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/No se pudieron extraer datos/i));
    });
    expect(screen.getByLabelText('Monto')).toHaveValue(null);
  });

  it('en una transferencia, autoasocia el medio `transfer` del origen si ya existe (gasto), y precarga el banco', async () => {
    const account = makeAccount({
      id: 'acc-juan',
      type: 'transfer',
      bank: null,
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
    renderWithQueryClient(
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
    expect(screen.getByLabelText('Banco (opcional)')).toHaveValue('Banco Patagonia');
    expect(getOrCreateTransferAccountMock).not.toHaveBeenCalled();
  });

  it('en una transferencia, crea (lazy) el medio `transfer` del destino si no existe (ingreso), matcheando al miembro', async () => {
    const createdAccount = makeAccount({
      id: 'acc-maria',
      type: 'transfer',
      holder_name: 'María Gómez',
      owner_member_id: 'member-maria',
    });
    getOrCreateTransferAccountMock.mockResolvedValueOnce(createdAccount);
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
        members={[{ id: 'member-maria', name: 'María Gómez' }]}
      />,
    );

    await userEvent.click(screen.getByLabelText('Ingreso'));
    const file = new File(['x'], 'transferencia.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Comprobante (opcional)'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Extraer datos del comprobante' }));

    // El medio recién creado no está en `accounts` (props estáticas del test); en la
    // app real, la invalidación de la query lo trae y se selecciona solo. Acá lo que
    // importa es que se dispare la creación lazy con los datos correctos del miembro.
    await waitFor(() => {
      expect(getOrCreateTransferAccountMock).toHaveBeenCalledWith({
        ownerMemberId: 'member-maria',
        holderName: 'María Gómez',
      });
    });
  });
});
