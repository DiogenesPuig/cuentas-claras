import type { TransactionView } from '../api';
import { downloadCsv, toCsv, toExportRows } from '../export';

interface ExportButtonProps {
  transactions: TransactionView[];
}

/** Exporta a CSV el set de movimientos ya filtrado de `/movimientos` (FR-23). */
export function ExportButton({ transactions }: ExportButtonProps) {
  function handleExport() {
    const csv = toCsv(toExportRows(transactions));
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `movimientos-${today}.csv`);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={transactions.length === 0}
      className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
    >
      Exportar CSV
    </button>
  );
}
