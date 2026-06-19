import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel, useActiveMonth } from '@/hooks/useActiveMonth';

/** Navegación del período (mes) activo: ◂ Mes Año ▸. */
export function MonthSwitcher() {
  const { month, prevMonth, nextMonth } = useActiveMonth();

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-input bg-background">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={prevMonth}
        className="rounded-l-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-28 text-center text-sm font-medium" aria-live="polite">
        {formatMonthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={nextMonth}
        className="rounded-r-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
