import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatAmount } from '@/features/transactions/format';
import type { DimensionGroup } from '../aggregate';
import { chartColor } from './chartColors';

interface DonutChartProps {
  groups: DimensionGroup[];
  baseCurrency: string;
  /** Muestra la leyenda debajo del gráfico. Apagala si la info va en una columna aparte. */
  showLegend?: boolean;
}

/** Torta del desglose por dimensión (FR-22), valuado en gasto consolidado en la moneda base. */
export function DonutChart({ groups, baseCurrency, showLegend = true }: DonutChartProps) {
  const data = groups
    .filter((g) => g.consolidated.expense > 0)
    .map((g) => ({ name: g.label, value: g.consolidated.expense }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin gastos en este período para graficar.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%">
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={chartColor(index)} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatAmount(Number(value), baseCurrency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <ul className="space-y-1 text-sm">
          {data.map((entry, index) => (
            <li key={entry.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: chartColor(index) }}
                  aria-hidden
                />
                {entry.name}
              </span>
              <span className="font-medium">{formatAmount(entry.value, baseCurrency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
