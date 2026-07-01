import { CategoryList } from '@/features/categories';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Pantalla `/categorias`: gestión de categorías globales + propias del workspace activo. */
export function CategoriesPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);

  if (!workspaceId) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <CategoryList workspaceId={workspaceId} />
    </div>
  );
}
