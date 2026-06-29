import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAuth, useMyProfile, useUpdateMyProfile, profileSchema, type ProfileInput } from '@/features/auth';

/** Pantalla de perfil (MEJ-7): editar el nombre propio (global, lo ve todo el grupo). */
export function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '' },
  });

  // Precarga el nombre actual cuando llega del server. Depende del VALOR del nombre
  // (no de la identidad del objeto) para no re-ejecutarse en cada render.
  const profileName = profile?.name;
  useEffect(() => {
    if (profileName) reset({ name: profileName });
  }, [profileName, reset]);

  async function onSubmit(values: ProfileInput) {
    try {
      await updateProfile.mutateAsync(values.name);
      toast.success('Nombre actualizado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="profile-name" className="text-sm font-medium">
              Tu nombre
            </label>
            <input
              id="profile-name"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            <p className="text-xs text-muted-foreground">
              Así te ve el resto del grupo (en reportes, miembros e invitaciones).
            </p>
          </div>

          {user?.email && (
            <div className="space-y-1">
              <span className="text-sm font-medium">Email</span>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || updateProfile.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      )}
    </div>
  );
}
