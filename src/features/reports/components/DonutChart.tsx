import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatAmount } from '@/features/transactions';
import type { DimensionGroup } from '../aggregate';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

interface DonutChartProps {
  groups: DimensionGroup[];
  baseCurrency: string;
}

/** Torta del desglose por dimensión (FR-22), valuado en gasto consolidado en la moneda base. */
export function DonutChart({ groups, baseCurrency }: DonutChartProps) {
  const data = groups
    .filter((g) => g.consolidated.expense > 0)
    .map((g) => ({ name: g.key, value: g.consolidated.expense }));

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
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatAmount(Number(value), baseCurrency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-1 text-sm">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="font-medium">{formatAmount(entry.value, baseCurrency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
