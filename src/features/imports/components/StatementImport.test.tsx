import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatementImport } from './StatementImport';

// Mockeamos los barrels que arrastran `api.ts`→`supabase` (rompen sin env vars, ver memoria
// del barrel). En la pantalla inicial de subida los hijos pesados (AccountQuickCreate,
// StagingRow) no se renderizan, así que alcanza con stubs mínimos.
const parseMutateAsync = vi.fn();
const findHashesMutateAsync = vi.fn().mockResolvedValue([]);
const confirmMutateAsync = vi.fn();

vi.mock('../hooks', () => ({
  useParseStatement: () => ({ mutateAsync: parseMutateAsync, isPending: false }),
  useFindExistingHashes: () => ({ mutateAsync: findHashesMutateAsync, isPending: false }),
  useConfirmImport: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
}));

vi.mock('@/features/accounts', () => ({
  useAccounts: () => ({ data: [] }),
  useMembersForHolder: () => ({ data: [] }),
  accountLabel: (a: { name: string }) => a.name,
  CARD_NETWORKS: [],
}));

vi.mock('@/features/categories', () => ({
  useCategories: () => ({ data: [] }),
}));

vi.mock('@/features/transactions', () => ({}));

/** Promesa que se resuelve manualmente, para dejar un parseo "en curso". */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('StatementImport', () => {
  it('un doble click rápido en "Cargar y revisar" no dispara dos parseos (BUG-9)', async () => {
    const pending = deferred<unknown>();
    parseMutateAsync.mockReturnValueOnce(pending.promise);

    render(<StatementImport workspaceId="ws-1" />);

    const fileInput = screen.getByLabelText('Resumen (PDF)');
    await userEvent.upload(
      fileInput,
      new File(['%PDF-1.4'], 'resumen.pdf', { type: 'application/pdf' }),
    );

    const button = screen.getByRole('button', { name: 'Cargar y revisar' });
    // Dos clicks seguidos antes de que el primer parseo (pendiente) resuelva.
    await userEvent.click(button);
    await userEvent.click(button);

    await waitFor(() => expect(parseMutateAsync).toHaveBeenCalledTimes(1));
    pending.resolve({ cards: [] });
  });
});
