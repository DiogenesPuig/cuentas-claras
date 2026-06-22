import type { ReportFilters } from '../aggregate';

export interface ReportFilterOptions {
  persona: string[];
  banco: string[];
  medio: string[];
  categoria: string[];
}

interface ReportFilterBarProps {
  filters: ReportFilters;
  options: ReportFilterOptions;
  onChange: (filters: ReportFilters) => void;
}

const SELECTS: { key: keyof ReportFilterOptions; label: string; all: string }[] = [
  { key: 'persona', label: 'Persona', all: 'Todas' },
  { key: 'banco', label: 'Banco', all: 'Todos' },
  { key: 'medio', label: 'Medio', all: 'Todos' },
  { key: 'categoria', label: 'Categoría', all: 'Todas' },
];

/**
 * Filtros combinables y removibles para el detalle (persona/banco/medio/categoría). Cada uno
 * en "Todas/os" no filtra; se apilan con AND. Incluye "Limpiar" para sacar todos de una.
 */
export function ReportFilterBar({ filters, options, onChange }: ReportFilterBarProps) {
  const anyActive = SELECTS.some(({ key }) => filters[key]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {SELECTS.map(({ key, label, all }) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <select
            value={filters[key] ?? ''}
            onChange={(e) => onChange({ ...filters, [key]: e.target.value || null })}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">{all}</option>
            {options[key].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      ))}
      {anyActive && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-sm font-medium text-primary hover:underline"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
