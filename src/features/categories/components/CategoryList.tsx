import { useState } from 'react';
import { useMyRole, type MemberRole } from '@/features/workspaces';
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks';
import type { Category, CategoryInput } from '../api';
import { CategoryForm } from './CategoryForm';

const CAN_MANAGE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

interface CategoryGroupProps {
  title: string;
  categories: Category[];
  canManage: boolean;
  onEdit: (category: Category) => void;
}

function CategoryGroup({ title, categories, canManage, onEdit }: CategoryGroupProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              {category.icon && <span aria-hidden>{category.icon}</span>}
              {category.name}
              {category.workspace_id === null && (
                <span className="text-xs text-muted-foreground">(global)</span>
              )}
            </span>
            {canManage && category.workspace_id !== null && (
              <button
                type="button"
                onClick={() => onEdit(category)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Editar
              </button>
            )}
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Sin categorías.</li>
        )}
      </ul>
    </div>
  );
}

interface CategoryListProps {
  workspaceId: string;
}

/** Lista de categorías (globales + propias) separadas por gasto/ingreso, con alta/edición. */
export function CategoryList({ workspaceId }: CategoryListProps) {
  const { data: categories, isLoading } = useCategories(workspaceId);
  const { data: role } = useMyRole(workspaceId);
  const createCategory = useCreateCategory(workspaceId);
  const updateCategory = useUpdateCategory(workspaceId);

  const [editing, setEditing] = useState<Category | null>(null);
  const [creatingKind, setCreatingKind] = useState<'expense' | 'income' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = role !== null && role !== undefined && CAN_MANAGE_ROLES.includes(role);
  const isFormOpen = editing !== null || creatingKind !== null;

  function closeForm() {
    setEditing(null);
    setCreatingKind(null);
    setFormError(null);
  }

  async function handleSubmit(input: CategoryInput) {
    setFormError(null);
    try {
      if (editing) {
        await updateCategory.mutateAsync({ id: editing.id, input });
      } else {
        await createCategory.mutateAsync(input);
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la categoría.');
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando categorías…</p>;
  }

  const expenses = (categories ?? []).filter((c) => c.kind === 'expense');
  const incomes = (categories ?? []).filter((c) => c.kind === 'income');

  return (
    <div className="space-y-6">
      <CategoryGroup
        title="Gastos"
        categories={expenses}
        canManage={canManage}
        onEdit={setEditing}
      />
      <CategoryGroup
        title="Ingresos"
        categories={incomes}
        canManage={canManage}
        onEdit={setEditing}
      />

      {canManage && !isFormOpen && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCreatingKind('expense')}
            className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            + Categoría de gasto
          </button>
          <button
            type="button"
            onClick={() => setCreatingKind('income')}
            className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            + Categoría de ingreso
          </button>
        </div>
      )}

      {canManage && isFormOpen && (
        <div className="space-y-2 rounded-md border border-border p-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <CategoryForm
            category={editing ?? undefined}
            defaultKind={creatingKind ?? 'expense'}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={createCategory.isPending || updateCategory.isPending}
          />
        </div>
      )}
    </div>
  );
}
