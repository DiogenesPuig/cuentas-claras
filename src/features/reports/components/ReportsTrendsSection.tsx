import type { ConsolidationResult } from '@/lib/money';
import type { MonthlyTotal } from '../aggregate';
import { BarChart } from './BarChart';
import { ConsolidatedTotals } from './ConsolidatedTotals';

interface ReportsTrendsSectionProps {
  series: MonthlyTotal[];
  yearSeries: MonthlyTotal[];
  yearTotals: ConsolidationResult;
  baseCurrency: string;
  year: string;
}

/** "Mes a mes" (ventana de 6 meses, FR-24) + "Anual" (acumulado del año hasta el mes activo). */
export function ReportsTrendsSection({
  series,
  yearSeries,
  yearTotals,
  baseCurrency,
  year,
}: ReportsTrendsSectionProps) {
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Mes a mes</h2>
        <BarChart series={series} baseCurrency={baseCurrency} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Anual — {year} (acumulado a la fecha)</h2>
        <ConsolidatedTotals consolidated={yearTotals} baseCurrency={baseCurrency} />
        <BarChart series={yearSeries} baseCurrency={baseCurrency} />
      </section>
    </>
  );
}
