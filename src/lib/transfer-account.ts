/**
 * Atribución del medio/persona en un comprobante de transferencia (F2-9, decisión
 * de la charla 2026-06-23): el lado "dueño" depende del tipo de movimiento —
 * en un **gasto** es el **origen** (quien envía); en un **ingreso**, el **destino**
 * (quien recibe). La contraparte (el otro lado) sirve como descripción sugerida.
 * Lógica PURA y testeable: no conoce React ni el `TransactionType` de la DB.
 */

export type TransferType = 'expense' | 'income';
export type TransferSide = 'origin' | 'dest';

export interface TransferPartyInfo {
  originHolder: string | null;
  originBank: string | null;
  destHolder: string | null;
  destBank: string | null;
}

/** Lado dueño del medio según el tipo: gasto → origen, ingreso → destino. */
export function ownerSideFor(type: TransferType): TransferSide {
  return type === 'expense' ? 'origin' : 'dest';
}

export function holderFor(info: TransferPartyInfo, side: TransferSide): string | null {
  return side === 'origin' ? info.originHolder : info.destHolder;
}

export function bankFor(info: TransferPartyInfo, side: TransferSide): string | null {
  return side === 'origin' ? info.originBank : info.destBank;
}

/** El otro lado de `side`: sirve como descripción sugerida del movimiento. */
export function counterpartyFor(info: TransferPartyInfo, side: TransferSide): string | null {
  return side === 'origin' ? info.destHolder : info.originHolder;
}

export interface TransferAccountDefaults {
  name: string;
  bank: string;
  holderName: string;
}

/** Valores para precargar el alta del medio `bank_account` del lado dueño. */
export function transferAccountDefaults(
  holder: string | null,
  bank: string | null,
): TransferAccountDefaults {
  return {
    name: ['Transferencia', bank].filter(Boolean).join(' ') || 'Transferencia',
    bank: bank ?? '',
    holderName: holder ?? '',
  };
}
