import type { Category } from '@/features/categories';
import { formatInstallment } from '@/features/transactions';
import type { EditableRow } from '../staging';

interface StagingRowProps {
  row: EditableRow;
  categories: Category[];
  onChange: (patch: Partial<EditableRow>) => void;
}

/** Una fila editable del staging: incluir, fecha, descripción, monto, categoría. */
export function StagingRow({ row, categories, onChange }: StagingRowProps) {
  const cuota = formatInstallment(row.installmentN, row.installmentTotal);
  const inputCls = 'rounded-md border border-input bg-background px-2 py-1 text-sm';

  return (
    <tr className={row.include ? '' : 'opacity-50'}>
      <td className="px-2 py-1">
        <input
          type="checkbox"
          checked={row.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          aria-label="Incluir movimiento"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          inputMode="numeric"
          value={row.occurredOn}
          placeholder="DD/MM/AAAA"
          onChange={(e) => onChange({ occurredOn: e.target.value })}
          className={`${inputCls} w-28`}
          aria-label="Fecha"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={`${inputCls} w-full min-w-40`}
          aria-label="Descripción"
        />
        {(cuota || row.kind !== 'charge') && (
          <span className="ml-1 text-xs text-muted-foreground">
            {[
              cuota,
              row.kind === 'payment' && 'pago de tarjeta',
              row.kind === 'refund' && 'reintegro (resta)',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </td>
      <td className="px-2 py-1 text-right">
        <input
          type="number"
          step="0.01"
          min="0"
          value={row.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          className={`${inputCls} w-28 text-right`}
          aria-label="Monto"
        />
        <span className="ml-1 text-xs text-muted-foreground">{row.currency}</span>
      </td>
      <td className="px-2 py-1">
        <select
          value={row.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value })}
          className={inputCls}
          aria-label="Categoría"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ''}
              {c.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
