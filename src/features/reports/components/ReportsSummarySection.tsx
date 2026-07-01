import type { ConsolidationResult } from '@/lib/money';
import type { DimensionGroup, ReportDimension } from '../aggregate';
import { DonutChart } from './DonutChart';
import { GroupBreakdown } from './GroupBreakdown';
import { ReportTabs } from './ReportTabs';

interface ReportsSummarySectionProps {
  dimension: ReportDimension;
  onDimensionChange: (dimension: ReportDimension) => void;
  expenseGroups: DimensionGroup[];
  incomeGroups: DimensionGroup[];
  totals: ConsolidationResult;
  baseCurrency: string;
}

/**
 * [2]/[3] de `/reportes` (MEJ-5): donut de gastos (por la dimensión elegida) + donut de
 * ingresos por persona, en espejo (mismo total, `complement` gris con la otra métrica).
 */
export function ReportsSummarySection({
  dimension,
  onDimensionChange,
  expenseGroups,
  incomeGroups,
  totals,
  baseCurrency,
}: ReportsSummarySectionProps) {
  return (
    <section className="grid gap-6 md:grid-cols-2 md:items-start">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Gastos</h2>
          <ReportTabs value={dimension} onChange={onDimensionChange} />
        </div>
        <DonutChart
          groups={expenseGroups}
          baseCurrency={baseCurrency}
          metric="expense"
          complement={{ label: 'Ingresos', value: totals.income }}
          showLegend={false}
        />
        <GroupBreakdown groups={expenseGroups} baseCurrency={baseCurrency} metric="expense" />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Ingresos por persona</h2>
        <DonutChart
          groups={incomeGroups}
          baseCurrency={baseCurrency}
          metric="income"
          complement={{ label: 'Gastos', value: totals.expense }}
          complementPosition="start"
          showLegend={false}
        />
        <GroupBreakdown groups={incomeGroups} baseCurrency={baseCurrency} metric="income" />
      </div>
    </section>
  );
}
