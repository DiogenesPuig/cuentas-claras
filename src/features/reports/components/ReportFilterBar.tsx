import type { ReportFilters } from '../aggregate';

export interface ReportFilterOptions {
  persona: string[];
  categoria: string[];
  medio: string[];
}

interface ReportFilterBarProps {
  filters: ReportFilters;
  options: ReportFilterOptions;
  onChange: (filters: ReportFilters) => void;
}

const SELECTS: { key: keyof ReportFilterOptions; label: string; all: string }[] = [
  { key: 'persona', label: 'Persona', all: 'Todas' },
  { key: 'categoria', label: 'Categoría', all: 'Todas' },
  { key: 'medio', label: 'Medio', all: 'Todos' },
];

/** Filtros combinables del reporte (persona/categoría/medio). '' = sin filtrar esa dimensión. */
export function ReportFilterBar({ filters, options, onChange }: ReportFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
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
    </div>
  );
}
