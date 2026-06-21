import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BASE_CURRENCIES, FX_QUOTES, workspaceSettingsSchema, type WorkspaceSettingsFormInput } from '../schema';
import { useUpdateWorkspaceSettings, useWorkspace } from '../hooks';

const QUOTE_LABELS: Record<WorkspaceSettingsFormInput['fxQuote'], string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  mep: 'MEP',
};

interface WorkspaceSettingsProps {
  workspaceId: string;
}

/** Edita name/base_currency/fx_quote del workspace activo (owner/admin). */
export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const updateSettings = useUpdateWorkspaceSettings(workspaceId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceSettingsFormInput>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: { name: '', baseCurrency: 'ARS', fxQuote: 'oficial' },
  });

  useEffect(() => {
    if (!workspace) return;
    reset({
      name: workspace.name,
      baseCurrency: workspace.base_currency as WorkspaceSettingsFormInput['baseCurrency'],
      fxQuote: workspace.fx_quote as WorkspaceSettingsFormInput['fxQuote'],
    });
  }, [workspace, reset]);

  if (isLoading || !workspace) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  async function handleFormSubmit(values: WorkspaceSettingsFormInput) {
    await updateSettings.mutateAsync(values);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="ws-name" className="text-sm font-medium">
          Nombre del grupo
        </label>
        <input
          id="ws-name"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="ws-base-currency" className="text-sm font-medium">
            Moneda base
          </label>
          <select
            id="ws-base-currency"
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

        <div className="space-y-1">
          <label htmlFor="ws-fx-quote" className="text-sm font-medium">
            Cotización
          </label>
          <select
            id="ws-fx-quote"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('fxQuote')}
          >
            {FX_QUOTES.map((quote) => (
              <option key={quote} value={quote}>
                {QUOTE_LABELS[quote]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={updateSettings.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Guardar cambios
      </button>
    </form>
  );
}
