import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount } from '@/features/transactions';
import { formatMonthLabel } from '@/hooks/useActiveMonth';
import type { MonthlyTotal } from '../aggregate';

interface BarChartProps {
  series: MonthlyTotal[];
  baseCurrency: string;
}

/** Abrevia montos grandes para que entren en el eje (ej. 300000 → "300 k"). */
function formatCompact(value: number): string {
  if (Math.abs(value) < 1000) return String(value);
  return `${Math.round(value / 1000)} k`;
}

/** Comparativa mes a mes (FR-24): ingresos/gastos consolidados en la moneda base. */
export function BarChart({ series, baseCurrency }: BarChartProps) {
  const data = series.map((m) => ({
    month: formatMonthLabel(m.month).slice(0, 3),
    Ingresos: m.consolidated.income,
    Gastos: m.consolidated.expense,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} tickFormatter={formatCompact} />
          <Tooltip formatter={(value) => formatAmount(Number(value), baseCurrency)} />
          <Bar dataKey="Ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
