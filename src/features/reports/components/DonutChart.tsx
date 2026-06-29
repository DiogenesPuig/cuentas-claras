import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatAmount } from '@/features/transactions/format';
import type { DimensionGroup } from '../aggregate';
import { chartColor, COMPLEMENT_COLOR } from './chartColors';

interface DonutChartProps {
  groups: DimensionGroup[];
  baseCurrency: string;
  /** Muestra la leyenda debajo del gráfico. Apagala si la info va en una columna aparte. */
  showLegend?: boolean;
  /** Qué métrica consolidada grafica cada porción (MEJ-5: donut de ingresos vs gastos). */
  metric?: 'expense' | 'income';
  /**
   * Porción gris "complemento" (MEJ-5): la otra métrica del período sin detallar, para que el
   * donut de gastos y el de ingresos se vean como espejo (mismo total = ingresos + gastos). En
   * el donut de gastos es el total de ingresos en gris, y viceversa. No aparece si es <= 0.
   */
  complement?: { label: string; value: number };
  /**
   * Dónde va la porción gris del complemento (MEJ-5). Para que el espejo sea real, los gastos
   * deben ocupar el MISMO arco en ambos donut: en el de gastos van primero (`complement` ingresos
   * al final, `'end'`); en el de ingresos el gris de gastos va primero (`'start'`), así el arco de
   * gastos arranca en el mismo lugar y solo cambia el color.
   */
  complementPosition?: 'start' | 'end';
}

/** Torta del desglose por dimensión (FR-22), valuado en gasto/ingreso consolidado en la moneda base. */
export function DonutChart({
  groups,
  baseCurrency,
  showLegend = true,
  metric = 'expense',
  complement,
  complementPosition = 'end',
}: DonutChartProps) {
  const data = groups
    .filter((g) => g.consolidated[metric] > 0)
    .map((g, index) => ({ name: g.label, value: g.consolidated[metric], color: chartColor(index) }));

  // Porción gris de la otra métrica (espejo), fuera de la paleta. Su posición fija el arco para
  // que gastos e ingresos ocupen el mismo lugar en ambos donut (ver `complementPosition`).
  if (complement && complement.value > 0) {
    const slice = { name: complement.label, value: complement.value, color: COMPLEMENT_COLOR };
    if (complementPosition === 'start') data.unshift(slice);
    else data.push(slice);
  }

  if (data.length === 0) {
    const what = metric === 'income' ? 'ingresos' : 'gastos';
    return (
      <p className="text-sm text-muted-foreground">Sin {what} en este período para graficar.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%">
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatAmount(Number(value), baseCurrency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <ul className="space-y-1 text-sm">
          {data.map((entry) => (
            <li key={entry.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
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
