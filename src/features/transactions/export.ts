import type { TransactionView } from './api';

/** Fila plana de exportación (FR-23): una columna por dato relevante del movimiento. */
export interface ExportRow {
  fecha: string;
  seCobra: string;
  tipo: string;
  monto: number;
  moneda: string;
  persona: string;
  medio: string;
  banco: string;
  categoria: string;
  descripcion: string;
}

const CSV_HEADERS: Array<[key: keyof ExportRow, label: string]> = [
  ['fecha', 'Fecha'],
  ['seCobra', 'Se cobra'],
  ['tipo', 'Tipo'],
  ['monto', 'Monto'],
  ['moneda', 'Moneda'],
  ['persona', 'Persona'],
  ['medio', 'Medio'],
  ['banco', 'Banco'],
  ['categoria', 'Categoría'],
  ['descripcion', 'Descripción'],
];

/** Mapea los movimientos ya filtrados (misma lista que `/movimientos`) a filas de exportación. */
export function toExportRows(transactions: TransactionView[]): ExportRow[] {
  return transactions.map((tx) => ({
    fecha: tx.occurred_on,
    seCobra: tx.charged_on ?? '',
    tipo: tx.type === 'income' ? 'Ingreso' : 'Gasto',
    monto: tx.amount,
    moneda: tx.currency,
    persona: tx.account?.holder_name ?? '',
    medio: tx.account?.name ?? '',
    banco: tx.account?.bank ?? '',
    categoria: tx.category?.name ?? '',
    descripcion: tx.description ?? '',
  }));
}

/** Escapa un valor para CSV (comillas dobles si tiene coma, comilla o salto de línea). */
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Arma un CSV (separado por comas, UTF-8) a partir de las filas de exportación. */
export function toCsv(rows: ExportRow[]): string {
  const headerLine = CSV_HEADERS.map(([, label]) => escapeCsvField(label)).join(',');
  const lines = rows.map((row) =>
    CSV_HEADERS.map(([key]) => escapeCsvField(String(row[key]))).join(','),
  );
  return [headerLine, ...lines].join('\n');
}

/** Dispara la descarga de un CSV en el navegador (con BOM UTF-8 para que Excel lo reconozca). */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
