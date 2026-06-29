/** Paleta compartida entre el donut y las listas de desglose, para que el color de cada
 * porción coincida con su línea de info (mismo orden de grupos → mismo índice → mismo color). */
export const CHART_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/** Gris neutro para la porción "complemento" del donut (la otra métrica, sin detallar; MEJ-5). */
export const COMPLEMENT_COLOR = '#d4d4d8';
