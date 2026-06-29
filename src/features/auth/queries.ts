import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProfile, upsertMyProfile, type Profile } from './api';
import { useAuth } from './context';

export const profileKeys = {
  mine: ['profile', 'mine'] as const,
};

/** Perfil del usuario autenticado (MEJ-7). Habilitado solo con sesión activa. */
export function useMyProfile() {
  const { user } = useAuth();
  return useQuery<Profile | null>({
    queryKey: profileKeys.mine,
    queryFn: getMyProfile,
    enabled: !!user,
  });
}

/**
 * Actualiza el nombre del perfil propio (MEJ-7, global). Al cambiarlo, invalida las
 * queries que muestran el nombre vivo del miembro: el directorio que usan los reportes
 * (`accounts/members` → `member_directory`) y los miembros del grupo (`workspaces/members`),
 * así el nombre nuevo aparece sin recargar.
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, string>({
    mutationFn: (name) => upsertMyProfile(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.mine });
      void queryClient.invalidateQueries({ queryKey: ['accounts', 'members'] });
      void queryClient.invalidateQueries({ queryKey: ['workspaces', 'members'] });
    },
  });
}
