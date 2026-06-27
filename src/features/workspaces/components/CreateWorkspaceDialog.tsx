import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateWorkspace } from '../hooks';
import { BASE_CURRENCIES, createWorkspaceSchema, type CreateWorkspaceFormInput } from '../schema';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el id del grupo recién creado (p. ej. para activarlo). */
  onCreated: (workspaceId: string) => void;
}

/** Modal para crear un grupo adicional (nombre + moneda base). Reusable en el switcher y en /grupo. */
export function CreateWorkspaceDialog({ open, onClose, onCreated }: CreateWorkspaceDialogProps) {
  const createWorkspace = useCreateWorkspace();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceFormInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: '', baseCurrency: 'ARS' },
  });

  if (!open) return null;

  async function onSubmit(values: CreateWorkspaceFormInput) {
    setFormError(null);
    try {
      const workspace = await createWorkspace.mutateAsync({
        name: values.name,
        base_currency: values.baseCurrency,
      });
      reset({ name: '', baseCurrency: 'ARS' });
      onCreated(workspace.id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el grupo.');
    }
  }

  function handleClose() {
    setFormError(null);
    reset({ name: '', baseCurrency: 'ARS' });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo grupo"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 md:items-center"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-md bg-background p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Nuevo grupo</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="new-workspace-name" className="text-sm font-medium">
              Nombre del grupo
            </label>
            <input
              id="new-workspace-name"
              type="text"
              placeholder="Ej: Casa, Personal, Viaje…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="new-workspace-currency" className="text-sm font-medium">
              Moneda base
            </label>
            <select
              id="new-workspace-currency"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('baseCurrency')}
            >
              {BASE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createWorkspace.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Crear grupo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
