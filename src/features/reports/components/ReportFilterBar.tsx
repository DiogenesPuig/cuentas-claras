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

const SELECTS: { key: keyof ReportFilterOptions; label: string; add: string }[] = [
  { key: 'persona', label: 'Persona', add: '+ Persona' },
  { key: 'banco', label: 'Banco', add: '+ Banco' },
  { key: 'medio', label: 'Medio', add: '+ Medio' },
  { key: 'categoria', label: 'Categoría', add: '+ Categoría' },
];

/**
 * Filtros combinables y removibles para el detalle (persona/banco/medio/categoría). Se pueden
 * apilar VARIOS valores por dimensión (ej. Transporte + Salud): el select agrega y cada valor
 * elegido queda como chip con "×" para sacarlo. "Limpiar" saca todos de una.
 */
export function ReportFilterBar({ filters, options, onChange }: ReportFilterBarProps) {
  const valuesOf = (key: keyof ReportFilterOptions) => filters[key] ?? [];
  const anyActive = SELECTS.some(({ key }) => valuesOf(key).length > 0);

  const add = (key: keyof ReportFilterOptions, value: string) => {
    if (!value || valuesOf(key).includes(value)) return;
    onChange({ ...filters, [key]: [...valuesOf(key), value] });
  };
  const remove = (key: keyof ReportFilterOptions, value: string) => {
    onChange({ ...filters, [key]: valuesOf(key).filter((v) => v !== value) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {SELECTS.map(({ key, label, add: addLabel }) => {
          const available = options[key].filter((opt) => !valuesOf(key).includes(opt));
          return (
            <label key={key} className="flex items-center gap-2 text-sm">
              <span className="sr-only">{label}</span>
              <select
                value=""
                onChange={(e) => add(key, e.target.value)}
                disabled={available.length === 0}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-50"
              >
                <option value="">{addLabel}</option>
                {available.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
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

      {anyActive && (
        <div className="flex flex-wrap items-center gap-2">
          {SELECTS.flatMap(({ key, label }) =>
            valuesOf(key).map((value) => (
              <span
                key={`${key}:${value}`}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-medium">{value}</span>
                <button
                  type="button"
                  onClick={() => remove(key, value)}
                  aria-label={`Quitar ${label} ${value}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            )),
          )}
        </div>
      )}
    </div>
  );
}
