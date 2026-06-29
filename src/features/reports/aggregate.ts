import { consolidateHistorical, type ConsolidationResult, type RateLookup } from '@/lib/money';
import { resolveFxDate } from '@/lib/fx';
import { normalizeNameKey } from '@/lib/name-match';
import type { ReportTransactionView } from './api';

/** Mapa `workspace_members.id` → nombre vivo del miembro (de `member_directory`). */
export type MemberNameById = ReadonlyMap<string, string>;
const NO_MEMBERS: MemberNameById = new Map();

export const REPORT_DIMENSIONS = ['categoria', 'persona', 'banco', 'red', 'medio'] as const;
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

export const REPORT_DIMENSION_LABELS: Record<ReportDimension, string> = {
  categoria: 'Categoría',
  persona: 'Persona',
  banco: 'Banco',
  red: 'Red',
  medio: 'Medio',
};

const NO_CATEGORY = 'Sin categoría';
const NO_ACCOUNT = 'Sin medio';

interface PersonaIdentity {
  /** Clave de agrupación: `member:<owner_member_id>` o `name:<holder_name normalizado>`. */
  key: string;
  /** Nombre legible: el vivo del miembro, o el `holder_name` tal cual está en el medio. */
  label: string;
}

/**
 * Identidad de "persona" de un movimiento (F2-10): agrupa por `owner_member_id` (id estable
 * del miembro) cuando el medio está ligado a uno, así dos `holder_name` distintos del mismo
 * dueño (apellido+nombre vs nombre+apellido, con/sin tildes en cada banco) caen en un solo
 * grupo. Si el medio no tiene miembro, cae a `holder_name` normalizado (tildes/orden) para no
 * duplicar a la misma persona sin fusionar personas realmente distintas.
 */
function personaIdentity(tx: ReportTransactionView, memberNameById: MemberNameById): PersonaIdentity {
  const account = tx.account;
  if (!account) return { key: NO_ACCOUNT, label: NO_ACCOUNT };
  if (account.owner_member_id) {
    return {
      key: `member:${account.owner_member_id}`,
      label: memberNameById.get(account.owner_member_id) ?? account.holder_name,
    };
  }
  return { key: `name:${normalizeNameKey(account.holder_name)}`, label: account.holder_name };
}

/** Clave de agrupación (FR-22) según la dimensión elegida. */
function dimensionKeyFor(
  dimension: ReportDimension,
  tx: ReportTransactionView,
  memberNameById: MemberNameById = NO_MEMBERS,
): string {
  switch (dimension) {
    case 'categoria':
      return tx.category?.name ?? NO_CATEGORY;
    case 'persona':
      return personaIdentity(tx, memberNameById).key;
    case 'banco':
      return tx.account?.bank ?? NO_ACCOUNT;
    case 'red':
      return tx.account?.network ?? NO_ACCOUNT;
    case 'medio':
      return tx.account?.name ?? NO_ACCOUNT;
  }
}

/** Etiqueta legible (FR-22) según la dimensión elegida: igual a la clave salvo para "persona". */
export function dimensionLabelFor(
  dimension: ReportDimension,
  tx: ReportTransactionView,
  memberNameById: MemberNameById = NO_MEMBERS,
): string {
  if (dimension === 'persona') return personaIdentity(tx, memberNameById).label;
  return dimensionKeyFor(dimension, tx, memberNameById);
}

/** Fecha de FX de un movimiento del reporte (ver `lib/fx.resolveFxDate`). */
function rateDateFor(tx: ReportTransactionView): string {
  return resolveFxDate(
    { occurredOn: tx.occurred_on, chargedOn: tx.charged_on },
    tx.account
      ? { type: tx.account.type, billingCloseDay: tx.account.billing_close_day }
      : null,
  );
}

/** Consolida un lote de movimientos del reporte, resolviendo la fecha de FX de cada uno. */
export function consolidateTransactions(
  transactions: ReportTransactionView[],
  base: string,
  rateFor: RateLookup,
): ConsolidationResult {
  return consolidateHistorical(
    transactions.map((tx) => ({
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      rateDate: rateDateFor(tx),
    })),
    base,
    rateFor,
  );
}

export interface DimensionGroup {
  /** Clave de agrupación (interna; para "persona" es `member:<id>` o `name:<normalizado>`). */
  key: string;
  /** Etiqueta legible para mostrar (nombre vivo del miembro u otra dimensión literal). */
  label: string;
  consolidated: ConsolidationResult;
}

/**
 * Agrupa los movimientos por `dimension` y consolida cada grupo (FR-22), usando el FX
 * histórico de cada movimiento. Los grupos suman, entre todos, el total del período:
 * todo movimiento cae en exactamente un grupo (con "Sin categoría"/"Sin medio" de fallback).
 * `memberNameById` resuelve la etiqueta de "persona" cuando el medio tiene `owner_member_id`
 * (F2-10); para las demás dimensiones no hace falta.
 * Orden: por volumen total (ingreso + gasto) consolidado, de mayor a menor.
 */
export function aggregateByDimension(
  transactions: ReportTransactionView[],
  dimension: ReportDimension,
  base: string,
  rateFor: RateLookup,
  memberNameById: MemberNameById = NO_MEMBERS,
): DimensionGroup[] {
  const byKey = new Map<string, { txs: ReportTransactionView[]; label: string }>();
  for (const tx of transactions) {
    const key = dimensionKeyFor(dimension, tx, memberNameById);
    const entry = byKey.get(key) ?? { txs: [], label: dimensionLabelFor(dimension, tx, memberNameById) };
    entry.txs.push(tx);
    byKey.set(key, entry);
  }

  const groups: DimensionGroup[] = Array.from(byKey.entries()).map(([key, { txs, label }]) => ({
    key,
    label,
    consolidated: consolidateTransactions(txs, base, rateFor),
  }));

  return groups.sort(
    (a, b) =>
      b.consolidated.income + b.consolidated.expense - (a.consolidated.income + a.consolidated.expense),
  );
}

/** Etiqueta/clave de la porción que agrupa a todos los no-miembros en los donut de resumen (MEJ-5). */
export const OTHERS_LABEL = 'Otros';
const OTHERS_KEY = 'otros';

/**
 * Como `aggregateByDimension(..., 'persona', ...)` pero colapsa a TODOS los no-miembros
 * (medios sin `owner_member_id`, y los movimientos sin medio) en una única porción "Otros",
 * dejando a cada miembro del workspace como porción propia (MEJ-5). Pensado para los donut de
 * resumen de `/reportes`, donde el usuario solo quiere ver individualizados a los miembros del
 * grupo (las transferencias de gente ajena no se detallan en el resumen). El detalle por filtro
 * sigue usando `aggregateByDimension` (sin colapsar) para poder ver un no-miembro puntual.
 * "Otros" no aparece si no hay no-miembros. Reusa `personaIdentity` (mismo criterio F2-10).
 */
export function aggregateByPersonaMembersOnly(
  transactions: ReportTransactionView[],
  base: string,
  rateFor: RateLookup,
  memberNameById: MemberNameById = NO_MEMBERS,
): DimensionGroup[] {
  const byKey = new Map<string, { txs: ReportTransactionView[]; label: string }>();
  for (const tx of transactions) {
    const identity = personaIdentity(tx, memberNameById);
    const isMember = identity.key.startsWith('member:');
    const key = isMember ? identity.key : OTHERS_KEY;
    const label = isMember ? identity.label : OTHERS_LABEL;
    const entry = byKey.get(key) ?? { txs: [], label };
    entry.txs.push(tx);
    byKey.set(key, entry);
  }

  const groups: DimensionGroup[] = Array.from(byKey.entries()).map(([key, { txs, label }]) => ({
    key,
    label,
    consolidated: consolidateTransactions(txs, base, rateFor),
  }));

  return groups.sort(
    (a, b) =>
      b.consolidated.income + b.consolidated.expense - (a.consolidated.income + a.consolidated.expense),
  );
}

/**
 * Filtros combinables del reporte. Cada dimensión acepta VARIOS valores: dentro de una
 * dimensión se combinan con OR (ej. categoría = Transporte o Salud), y entre dimensiones con
 * AND (ej. esa categoría Y tal persona). Array vacío/ausente = sin filtrar esa dimensión.
 */
export interface ReportFilters {
  persona?: string[];
  categoria?: string[];
  medio?: string[];
  banco?: string[];
  red?: string[];
}

/**
 * Subconjunto de movimientos que cumple todos los filtros activos (FR-22). Los valores de
 * filtro son etiquetas legibles (las que ve el usuario), no la clave interna de agrupación.
 */
export function filterReportTransactions(
  transactions: ReportTransactionView[],
  filters: ReportFilters,
  memberNameById: MemberNameById = NO_MEMBERS,
): ReportTransactionView[] {
  const active = (Object.entries(filters) as [ReportDimension, string[] | undefined][]).filter(
    ([, values]) => values && values.length > 0,
  );
  if (active.length === 0) return transactions;
  return transactions.filter((tx) =>
    active.every(([dimension, values]) => values!.includes(dimensionLabelFor(dimension, tx, memberNameById))),
  );
}

/** Categoría dominante de una persona si supera este umbral de su gasto; si no, "Varios". */
const DOMINANT_THRESHOLD = 0.4;
const MIXED_LABEL = 'Varios';

export interface PersonaSpending {
  /** Clave de identidad de la persona (`member:<id>` o `name:<norm>`); para apodos (MEJ-8). */
  key: string;
  /** Persona: nombre vivo del miembro (si el medio tiene `owner_member_id`) o `holder_name`. */
  holder: string;
  /** Gasto consolidado de la persona, en la moneda base. */
  expense: number;
  /** Fracción 0..1 del gasto total del período que aporta esta persona. */
  share: number;
  /** Categoría en la que más gastó (o null si no tiene categoría). */
  mainCategory: string | null;
  /** Etiqueta legible: la categoría dominante o "Varios" si ninguna supera el umbral. */
  mainLabel: string;
}

/**
 * Gasto por persona (FR-22): cuánto aporta cada holder al gasto total del período, su
 * participación (`share`) y en qué categoría gastó mayormente. Ordenado de mayor a menor
 * gasto. Solo considera gastos (no ingresos). Pensado para "p1 = 50% (mayormente en super)".
 */
export function personaSpending(
  transactions: ReportTransactionView[],
  base: string,
  rateFor: RateLookup,
  memberNameById: MemberNameById = NO_MEMBERS,
): PersonaSpending[] {
  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const byHolder = aggregateByDimension(expenses, 'persona', base, rateFor, memberNameById);
  const totalExpense = byHolder.reduce((sum, group) => sum + group.consolidated.expense, 0);

  return byHolder
    .filter((group) => group.consolidated.expense > 0)
    .map((group) => {
      const holderTxs = expenses.filter(
        (tx) => dimensionKeyFor('persona', tx, memberNameById) === group.key,
      );
      const byCategory = aggregateByDimension(holderTxs, 'categoria', base, rateFor);
      const top = byCategory.find((c) => c.consolidated.expense > 0) ?? null;
      const holderExpense = group.consolidated.expense;
      const topShare = top ? top.consolidated.expense / holderExpense : 0;
      return {
        key: group.key,
        holder: group.label,
        expense: holderExpense,
        share: totalExpense > 0 ? holderExpense / totalExpense : 0,
        mainCategory: top?.key ?? null,
        mainLabel: top && topShare >= DOMINANT_THRESHOLD ? top.key : MIXED_LABEL,
      };
    });
}

export interface MonthlyTotal {
  /** `YYYY-MM`. */
  month: string;
  consolidated: ConsolidationResult;
}

/** Comparativa mes a mes (FR-24): un consolidado por cada mes de `months`, en orden. */
export function monthlySeries(
  transactions: ReportTransactionView[],
  months: string[],
  base: string,
  rateFor: RateLookup,
): MonthlyTotal[] {
  return months.map((month) => {
    const txs = transactions.filter((tx) => tx.occurred_on.startsWith(month));
    return { month, consolidated: consolidateTransactions(txs, base, rateFor) };
  });
}

export interface PersonaAccountInfo {
  accountName: string;
  isExtension: boolean;
  /** Holder de la tarjeta titular, si esta cuenta es una extensión que apunta a otra. */
  titularHolderName: string | null;
}

interface AccountForPersona {
  id: string;
  name: string;
  holder_name: string;
  owner_member_id: string | null;
  is_extension: boolean;
  parent_account_id: string | null;
}

function personaLabelForAccount(account: AccountForPersona, memberNameById: MemberNameById): string {
  if (account.owner_member_id) return memberNameById.get(account.owner_member_id) ?? account.holder_name;
  return account.holder_name;
}

/**
 * Para la vista "por persona" (FR-22): por cada persona (mismo criterio que `personaSpending`,
 * F2-10), sus medios, marcando cuáles son extensiones y de qué titular (holder de la cuenta
 * padre). Pura: recibe la lista completa de medios del workspace (no solo los que aparecen en
 * movimientos del período).
 */
export function personaAccounts(
  accounts: AccountForPersona[],
  memberNameById: MemberNameById = NO_MEMBERS,
): Map<string, PersonaAccountInfo[]> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const result = new Map<string, PersonaAccountInfo[]>();

  for (const account of accounts) {
    const titular = account.is_extension && account.parent_account_id
      ? byId.get(account.parent_account_id) ?? null
      : null;

    const label = personaLabelForAccount(account, memberNameById);
    const list = result.get(label) ?? [];
    list.push({
      accountName: account.name,
      isExtension: account.is_extension,
      titularHolderName: titular ? personaLabelForAccount(titular, memberNameById) : null,
    });
    result.set(label, list);
  }

  return result;
}
