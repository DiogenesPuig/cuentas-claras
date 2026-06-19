import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categorySchema, CATEGORY_KINDS, type CategoryFormInput } from '../schema';
import type { Category, CategoryInput } from '../api';

const KIND_LABELS: Record<CategoryFormInput['kind'], string> = {
  expense: 'Gasto',
  income: 'Ingreso',
};

interface CategoryFormProps {
  /** Si se pasa, el form edita esta categoría; si no, crea una nueva. */
  category?: Category;
  /** Tipo preseleccionado al crear (ignorado si `category` está presente). */
  defaultKind?: CategoryFormInput['kind'];
  onSubmit: (input: CategoryInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/** Alta/edición de una categoría propia del workspace. */
export function CategoryForm({
  category,
  defaultKind = 'expense',
  onSubmit,
  onCancel,
  isSubmitting,
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      kind: category?.kind ?? defaultKind,
      icon: category?.icon ?? '',
      color: category?.color ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: category?.name ?? '',
      kind: category?.kind ?? defaultKind,
      icon: category?.icon ?? '',
      color: category?.color ?? '',
    });
  }, [category, defaultKind, reset]);

  async function handleFormSubmit(values: CategoryFormInput) {
    await onSubmit({
      name: values.name,
      kind: values.kind,
      icon: values.icon || null,
      color: values.color || null,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="category-name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="category-name"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="category-kind" className="text-sm font-medium">
          Tipo
        </label>
        <select
          id="category-kind"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('kind')}
        >
          {CATEGORY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        {errors.kind && <p className="text-sm text-destructive">{errors.kind.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="category-icon" className="text-sm font-medium">
          Ícono (emoji, opcional)
        </label>
        <input
          id="category-icon"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('icon')}
        />
        {errors.icon && <p className="text-sm text-destructive">{errors.icon.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="category-color" className="text-sm font-medium">
          Color (opcional)
        </label>
        <input
          id="category-color"
          type="text"
          placeholder="#22c55e"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('color')}
        />
        {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {category ? 'Guardar cambios' : 'Crear categoría'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
