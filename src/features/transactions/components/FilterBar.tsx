import type { Category } from '@/features/categories';
import type { Account } from '@/features/accounts';
import { accountDisplayName } from '@/features/accounts/format';
import { EMPTY_FIELD_FILTERS, NO_ACCOUNT_FILTER, type FieldFilters } from '../filters';

export type FilterBarValue = FieldFilters;

/** Opción del filtro de persona (IDENT-1): la `key` es una `personaKeyOf(...)`. */
export interface PersonaOption {
  key: string;
  label: string;
}

interface FilterBarProps {
  value: FilterBarValue;
  categories: Category[];
  accounts: Account[];
  personaOptions: PersonaOption[];
  onChange: (value: FilterBarValue) => void;
}

function hasActiveFilters(value: FilterBarValue): boolean {
  return Boolean(value.accountId || value.categoryId || value.currency || value.personaKey);
}

/** Filtros combinables de la lista de movimientos: persona, medio, categoría y moneda (FR-11). */
export function FilterBar({ value, categories, accounts, personaOptions, onChange }: FilterBarProps) {
  function set<K extends keyof FilterBarValue>(key: K, fieldValue: FilterBarValue[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="filter-persona" className="text-xs font-medium text-muted-foreground">
          Persona
        </label>
        <select
          id="filter-persona"
          value={value.personaKey ?? ''}
          onChange={(event) => set('personaKey', event.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todas</option>
          {personaOptions.map((persona) => (
            <option key={persona.key} value={persona.key}>
              {persona.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="filter-account" className="text-xs font-medium text-muted-foreground">
          Medio
        </label>
        <select
          id="filter-account"
          value={value.accountId ?? ''}
          onChange={(event) => set('accountId', event.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <option value={NO_ACCOUNT_FILTER}>Sin medio</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {accountDisplayName(account)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="filter-category" className="text-xs font-medium text-muted-foreground">
          Categoría
        </label>
        <select
          id="filter-category"
          value={value.categoryId ?? ''}
          onChange={(event) => set('categoryId', event.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ''}
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="filter-currency" className="text-xs font-medium text-muted-foreground">
          Moneda
        </label>
        <input
          id="filter-currency"
          type="text"
          maxLength={3}
          value={value.currency ?? ''}
          onChange={(event) => set('currency', event.target.value.toUpperCase())}
          placeholder="ARS"
          className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm uppercase"
        />
      </div>

      {hasActiveFilters(value) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FIELD_FILTERS)}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
