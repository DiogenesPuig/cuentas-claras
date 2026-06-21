import { cn } from '@/lib/utils';
import { REPORT_DIMENSIONS, REPORT_DIMENSION_LABELS, type ReportDimension } from '../aggregate';

interface ReportTabsProps {
  value: ReportDimension;
  onChange: (dimension: ReportDimension) => void;
}

/** Pills para elegir la dimensión de desglose (categoría/persona/banco/red/medio — FR-22). */
export function ReportTabs({ value, onChange }: ReportTabsProps) {
  return (
    <div role="tablist" aria-label="Dimensión del reporte" className="flex flex-wrap gap-2">
      {REPORT_DIMENSIONS.map((dimension) => (
        <button
          key={dimension}
          type="button"
          role="tab"
          aria-selected={value === dimension}
          onClick={() => onChange(dimension)}
          className={cn(
            'rounded-full border border-border px-3 py-1 text-sm transition-colors',
            value === dimension
              ? 'border-primary bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {REPORT_DIMENSION_LABELS[dimension]}
        </button>
      ))}
    </div>
  );
}
