import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import {
  BASE_CURRENCIES,
  onboardingSchema,
  useCompleteOnboarding,
  useMyWorkspaces,
  type OnboardingInput,
} from '@/features/workspaces';

/** Nombre sugerido a partir del proveedor (OAuth) o de la parte local del email. */
function suggestedName(user: ReturnType<typeof useAuth>['user']): string {
  const metadata = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  if (metadata.full_name) return metadata.full_name;
  if (metadata.name) return metadata.name;
  const email = user?.email;
  if (email) return email.split('@')[0];
  return '';
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: workspaces, isLoading } = useMyWorkspaces();
  const completeOnboarding = useCompleteOnboarding();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: suggestedName(user),
      workspaceName: '',
      baseCurrency: 'ARS',
    },
  });

  // Si ya pertenece a un workspace, no debe ver el onboarding.
  if (!isLoading && workspaces && workspaces.length > 0) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(values: OnboardingInput) {
    setFormError(null);
    try {
      await completeOnboarding.mutateAsync(values);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el grupo.');
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">¡Bienvenido/a!</h1>
          <p className="text-sm text-muted-foreground">
            Creá tu primer grupo para empezar a registrar gastos.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="displayName" className="text-sm font-medium">
              Tu nombre
            </label>
            <input
              id="displayName"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="workspaceName" className="text-sm font-medium">
              Nombre del grupo
            </label>
            <input
              id="workspaceName"
              type="text"
              placeholder="Ej: Casa, Personal, Viaje…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('workspaceName')}
            />
            {errors.workspaceName && (
              <p className="text-sm text-destructive">{errors.workspaceName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="baseCurrency" className="text-sm font-medium">
              Moneda base
            </label>
            <select
              id="baseCurrency"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('baseCurrency')}
            >
              {BASE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            {errors.baseCurrency && (
              <p className="text-sm text-destructive">{errors.baseCurrency.message}</p>
            )}
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting || completeOnboarding.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Crear grupo
          </button>
        </form>
      </div>
    </main>
  );
}
