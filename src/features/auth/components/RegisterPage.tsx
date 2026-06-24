import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '../schema';
import { signUpWithPassword } from '../api';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Destino al que volver tras registrarse (p. ej. /invite/:token si vino de un link).
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      const data = await signUpWithPassword(values.email, values.password);
      if (data.session) {
        navigate(from ?? '/', { replace: true });
      } else {
        setConfirmationNotice(true);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    }
  }

  if (confirmationNotice) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
        <h1 className="text-2xl font-bold">Revisá tu email</h1>
        <p className="text-sm text-muted-foreground">
          Te enviamos un link para confirmar tu cuenta. Una vez confirmada, podés{' '}
          <Link to="/login" state={location.state} className="font-medium text-primary underline">
            iniciar sesión
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Cuentas Claras</h1>
          <p className="text-sm text-muted-foreground">Creá tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Crear cuenta
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" state={location.state} className="font-medium text-primary underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
