import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  listCategories,
  updateCategory,
  type Category,
  type CategoryInput,
  type CategoryKind,
} from './api';

export const categoriesKeys = {
  list: (workspaceId: string | undefined) => ['categories', workspaceId] as const,
};

/** Categorías (globales + propias) del workspace, opcionalmente filtradas por `kind`. */
export function useCategories(workspaceId: string | undefined, kind?: CategoryKind) {
  return useQuery({
    queryKey: categoriesKeys.list(workspaceId),
    queryFn: () => listCategories(workspaceId as string),
    enabled: workspaceId !== undefined,
    select: (categories) => (kind ? categories.filter((c) => c.kind === kind) : categories),
  });
}

export function useCreateCategory(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Category, Error, CategoryInput>({
    mutationFn: (input) => createCategory(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKeys.list(workspaceId) });
    },
  });
}

export function useUpdateCategory(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Category, Error, { id: string; input: CategoryInput }>({
    mutationFn: ({ id, input }) => updateCategory(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKeys.list(workspaceId) });
    },
  });
}
