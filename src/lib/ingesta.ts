/**
 * Cliente HTTP del microservicio de ingesta (OCR/parseo) — FR-14/FR-16.
 *
 * Capa de transporte PURA y portable: no importa Supabase ni React. Recibe la
 * `baseUrl` y el `accessToken` como parámetros (quien lo llama, en `api.ts`, los
 * obtiene de Supabase), así el día que cambie el backend solo se toca el llamador.
 * Es el único módulo de la web que habla con el micro; los componentes nunca lo
 * llaman directo (van por hooks → api.ts).
 */

export interface ReceiptExtraction {
  amount: number | null;
  currency: string | null;
  /** Fecha en ISO YYYY-MM-DD. */
  date: string | null;
  merchant: string | null;
  /** Confianza 0..1 de la extracción. */
  confidence: number;
}

export interface StatementInstallment {
  n: number;
  total: number;
}

export interface StatementRow {
  occurred_on: string | null;
  description: string | null;
  amount: number | null;
  currency: string | null;
  installment: StatementInstallment | null;
  /** 'charge' = consumo; 'refund' = reintegro/devolución (resta); 'payment' = pago de tarjeta (se excluye). */
  kind: 'charge' | 'refund' | 'payment';
  /** Nº de comprobante del resumen (si está): clave fuerte para dedupe (FR-17). */
  ref: string | null;
}

export interface StatementAccountHint {
  bank: string | null;
  network: string | null;
  last4: string | null;
  holder: string | null;
}

export interface StatementCard {
  account_hint: StatementAccountHint;
  rows: StatementRow[];
}

export interface StatementParse {
  /** Cierre/imputación del resumen (ISO) → charged_on de los movimientos. */
  statement_close_on: string | null;
  cards: StatementCard[];
}

/** Error de la llamada al micro (red, auth o respuesta no-2xx). */
export class IngestaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'IngestaError';
  }
}

interface CallOptions {
  baseUrl: string | undefined;
  accessToken: string | undefined;
  signal?: AbortSignal;
}

async function postMultipart<T>(path: string, form: FormData, opts: CallOptions): Promise<T> {
  if (!opts.baseUrl) {
    throw new IngestaError('Falta configurar la URL del microservicio (VITE_INGESTA_URL).');
  }
  if (!opts.accessToken) {
    throw new IngestaError('No hay sesión activa para llamar al microservicio.', 401);
  }

  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}` },
      body: form,
      signal: opts.signal,
    });
  } catch (err) {
    throw new IngestaError(
      err instanceof Error ? err.message : 'No se pudo contactar al microservicio.',
    );
  }

  if (!res.ok) {
    throw new IngestaError(`El microservicio respondió ${res.status}.`, res.status);
  }
  return (await res.json()) as T;
}

/** Extrae monto/fecha/comercio de un comprobante (FR-14). */
export function extractReceipt(
  file: File,
  opts: CallOptions,
): Promise<ReceiptExtraction> {
  const form = new FormData();
  form.append('file', file);
  return postMultipart<ReceiptExtraction>('/v1/receipts:extract', form, opts);
}

/** Parsea un resumen de tarjeta (FR-16). `password` para PDFs protegidos. */
export function parseStatement(
  file: File,
  opts: CallOptions & { password?: string },
): Promise<StatementParse> {
  const form = new FormData();
  form.append('file', file);
  if (opts.password) form.append('password', opts.password);
  return postMultipart<StatementParse>('/v1/statements:parse', form, opts);
}
