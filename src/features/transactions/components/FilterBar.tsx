import type { Category } from '@/features/categories';
import type { Account } from '@/features/accounts';
import { accountDisplayName } from '@/features/accounts/format';
import { EMPTY_FIELD_FILTERS, NO_ACCOUNT_FILTER, type FieldFilters } from '../filters';

export type FilterBarValue = FieldFilters;

interface FilterBarProps {
  value: FilterBarValue;
  categories: Category[];
  accounts: Account[];
  onChange: (value: FilterBarValue) => void;
}

function holderOptions(accounts: Account[]): string[] {
  return Array.from(new Set(accounts.map((a) => a.holder_name))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function hasActiveFilters(value: FilterBarValue): boolean {
  return Boolean(value.accountId || value.categoryId || value.currency || value.holderName);
}

/** Filtros combinables de la lista de movimientos: persona, medio, categoría y moneda (FR-11). */
export function FilterBar({ value, categories, accounts, onChange }: FilterBarProps) {
  function set<K extends keyof FilterBarValue>(key: K, fieldValue: FilterBarValue[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="filter-holder" className="text-xs font-medium text-muted-foreground">
          Persona
        </label>
        <select
          id="filter-holder"
          value={value.holderName ?? ''}
          onChange={(event) => set('holderName', event.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todas</option>
          {holderOptions(accounts).map((holder) => (
            <option key={holder} value={holder}>
              {holder}
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
