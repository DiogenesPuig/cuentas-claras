import { create } from 'zustand';

/** Mes/período en formato `YYYY-MM` (p. ej. `2026-06`). */
export type Month = string;

/** Mes actual en formato `YYYY-MM`. */
export function currentMonth(): Month {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Desplaza un mes `YYYY-MM` en `delta` meses (negativo = hacia atrás). */
export function shiftMonth(month: Month, delta: number): Month {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Etiqueta legible en español, p. ej. `2026-06` → `Junio 2026`. */
export function formatMonthLabel(month: Month): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  const name = new Intl.DateTimeFormat('es', { month: 'long' }).format(date);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

interface ActiveMonthState {
  /** Mes seleccionado en formato `YYYY-MM`. */
  month: Month;
  /** Fija un mes concreto. */
  setMonth: (month: Month) => void;
  /** Va al mes anterior. */
  prevMonth: () => void;
  /** Va al mes siguiente. */
  nextMonth: () => void;
}

/** Estado global del período (mes) seleccionado en el header. */
export const useActiveMonth = create<ActiveMonthState>((set, get) => ({
  month: currentMonth(),
  setMonth: (month) => set({ month }),
  prevMonth: () => set({ month: shiftMonth(get().month, -1) }),
  nextMonth: () => set({ month: shiftMonth(get().month, 1) }),
}));
