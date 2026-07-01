import { useMemo, useState } from 'react';
import { useAccounts, useMembersForHolder } from '@/features/accounts';
import {
  displayPersonaLabel,
  useAliases,
  useDeleteAlias,
  useUpsertAlias,
  type AliasMap,
} from '@/features/aliases';
import type { DimensionGroup } from '@/features/reports';
import {
  BarChart,
  ConsolidatedTotals,
  DonutChart,
  GroupBreakdown,
  PersonaBreakdown,
  ReportFilterBar,
  ReportTabs,
  aggregateByDimension,
  aggregateByPersonaMembersOnly,
  consolidateTransactions,
  dimensionLabelFor,
  filterReportTransactions,
  monthlySeries,
  personaAccounts,
  personaSpending,
  useFxRates,
  useReportTransactions,
  useWorkspaceFxSettings,
  type ReportDimension,
  type ReportFilterOptions,
  type ReportFilters,
} from '@/features/reports';
import { formatAmount } from '@/features/transactions/format';
import { buildRateIndex, lookupRate } from '@/lib/fx';
import { useActiveMonth, formatMonthLabel, shiftMonth } from '@/hooks/useActiveMonth';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Cantidad de meses (incluido el activo) que entran en la comparativa mes a mes (FR-24). */
const MONTHS_WINDOW = 6;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pantalla `/reportes`: desglose por dimensión + comparativa mes a mes (C13). */
export function ReportsPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);
  const activeMonth = useActiveMonth((state) => state.month);
  const [dimension, setDimension] = useState<ReportDimension>('persona');
  const [filters, setFilters] = useState<ReportFilters>({});
  /** Dimensión de desglose del bloque de detalle (cómo se abre el subconjunto filtrado). */
  const [detailDimension, setDetailDimension] = useState<ReportDimension>('categoria');

  const year = activeMonth.slice(0, 4);
  const months = useMemo(
    () => Array.from({ length: MONTHS_WINDOW }, (_, i) => shiftMonth(activeMonth, i - (MONTHS_WINDOW - 1))),
    [activeMonth],
  );
  // Meses del año en curso hasta el mes activo (para el acumulado anual).
  const yearMonths = useMemo(() => {
    const out: string[] = [];
    for (let m = 1; m <= 12; m += 1) {
      const month = `${year}-${String(m).padStart(2, '0')}`;
      if (month <= activeMonth) out.push(month);
    }
    return out;
  }, [year, activeMonth]);
  // La query cubre tanto la ventana de 6 meses como el año en curso (lo que arranque antes).
  const range = useMemo(() => {
    const windowStart = `${months[0]}-01`;
    const yearStart = `${year}-01-01`;
    return { from: windowStart < yearStart ? windowStart : yearStart, to: `${shiftMonth(activeMonth, 1)}-01` };
  }, [months, activeMonth, year]);

  const { data: fxSettings } = useWorkspaceFxSettings(workspaceId);
  const { data: transactions, isLoading } = useReportTransactions(workspaceId, range);
  const { data: accounts } = useAccounts(workspaceId);
  const { data: members } = useMembersForHolder(workspaceId);
  // Apodos privados del usuario (MEJ-8): pisan el nombre mostrado de cada persona.
  const { data: aliasData } = useAliases(workspaceId);
  const upsertAlias = useUpsertAlias(workspaceId);
  const deleteAlias = useDeleteAlias(workspaceId);

  // Nombre vivo del miembro por `owner_member_id` (F2-10): dedup de persona en los reportes.
  const memberNameById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.name])),
    [members],
  );

  const currencies = useMemo(() => {
    if (!transactions || !fxSettings) return [];
    const set = new Set(transactions.map((tx) => tx.currency).filter((c) => c !== fxSettings.baseCurrency));
    return Array.from(set);
  }, [transactions, fxSettings]);

  const { data: fxRates } = useFxRates(currencies, fxSettings?.fxSource, fxSettings?.fxQuote, todayIsoDate());

  const rateFor = useMemo(() => {
    const index = buildRateIndex(fxRates ?? []);
    return (currency: string, date: string) => lookupRate(index, currency, date);
  }, [fxRates]);

  if (!workspaceId) return null;

  const base = fxSettings?.baseCurrency ?? 'ARS';
  const allTransactions = transactions ?? [];
  const monthTransactions = allTransactions.filter((tx) => tx.occurred_on.startsWith(activeMonth));

  // RESUMEN del mes (MEJ-5): totales macro + donut de gastos y donut de ingresos separados.
  const totals = consolidateTransactions(monthTransactions, base, rateFor);
  // [2] Gastos por la dimensión elegida; en "persona" se colapsan los no-miembros en "Otros".
  const expenseGroups =
    dimension === 'persona'
      ? aggregateByPersonaMembersOnly(monthTransactions, base, rateFor, memberNameById)
      : aggregateByDimension(monthTransactions, dimension, base, rateFor, memberNameById);
  // [3] Ingresos por persona, SOLO miembros (los no-miembros caen en "Otros").
  const incomeGroups = aggregateByPersonaMembersOnly(monthTransactions, base, rateFor, memberNameById);
  const series = monthlySeries(allTransactions, months, base, rateFor);

  // Apodos (MEJ-8): pisan el label de cada grupo de persona (display-only; no afecta agrupación).
  const aliases: AliasMap = aliasData ?? {};
  const aliasGroups = (groups: DimensionGroup[]): DimensionGroup[] =>
    groups.map((g) => ({ ...g, label: displayPersonaLabel(g.key, g.label, aliases) }));
  // En gastos solo aplica cuando el desglose es por persona; en ingresos siempre es por persona.
  const expenseGroupsView = dimension === 'persona' ? aliasGroups(expenseGroups) : expenseGroups;
  const incomeGroupsView = aliasGroups(incomeGroups);

  // Opciones del filtro de detalle, a partir de lo que hay en el mes (FR-22).
  const distinct = (values: (string | null | undefined)[], fallback: string) =>
    Array.from(new Set(values.map((v) => v ?? fallback))).sort((a, b) => a.localeCompare(b, 'es'));
  const filterOptions: ReportFilterOptions = {
    persona: distinct(
      monthTransactions.map((tx) => dimensionLabelFor('persona', tx, memberNameById)),
      'Sin medio',
    ),
    banco: distinct(monthTransactions.map((tx) => tx.bank ?? tx.account?.bank), 'Sin medio'),
    medio: distinct(monthTransactions.map((tx) => tx.account?.name), 'Sin medio'),
    categoria: distinct(monthTransactions.map((tx) => tx.category?.name), 'Sin categoría'),
  };

  // [4] DETALLE por filtro: los filtros (apilables) recortan el subconjunto y se ve su desglose
  // por la dimensión elegida. Sin filtro = todo el mes (nunca vacío). A diferencia de los donut
  // de resumen, acá NO se colapsan no-miembros: un titular ajeno puntual sí se puede ver.
  const activeFilterValues = [
    ...(filters.persona ?? []),
    ...(filters.banco ?? []),
    ...(filters.medio ?? []),
    ...(filters.categoria ?? []),
  ];
  const detailTxs = filterReportTransactions(monthTransactions, filters, memberNameById);
  const detailGroups = aggregateByDimension(detailTxs, detailDimension, base, rateFor, memberNameById);
  const detailTotal = consolidateTransactions(detailTxs, base, rateFor).expense;
  const detailPersonas = personaSpending(detailTxs, base, rateFor, memberNameById);
  const personaInfo = personaAccounts(accounts ?? [], memberNameById);
  const detailLabel = activeFilterValues.join(' · ') || 'Todo el mes';

  // Apodos en la lista por persona del detalle (MEJ-8): mostrar + editar inline.
  const personaAliasing = {
    labelFor: (key: string, baseLabel: string) => displayPersonaLabel(key, baseLabel, aliases),
    onSave: (key: string, alias: string) => upsertAlias.mutate({ personaKey: key, alias }),
    onClear: (key: string) => deleteAlias.mutate(key),
  };

  // Vista ANUAL (acumulado del año hasta el mes activo).
  const yearTransactions = allTransactions.filter((tx) => tx.occurred_on.startsWith(year));
  const yearTotals = consolidateTransactions(yearTransactions, base, rateFor);
  const yearSeries = monthlySeries(allTransactions, yearMonths, base, rateFor);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
      <p className="text-sm text-muted-foreground">{formatMonthLabel(activeMonth)}</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {/* [1] INGRESOS VS GASTOS — foto macro del mes (sin desglose). */}
          <ConsolidatedTotals consolidated={totals} baseCurrency={base} />

          {/* [2] GASTOS (izq) + [3] INGRESOS (der) — donuts de resumen, solo miembros + "Otros". */}
          <section className="grid gap-6 md:grid-cols-2 md:items-start">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Gastos</h2>
                <ReportTabs value={dimension} onChange={setDimension} />
              </div>
              <DonutChart
                groups={expenseGroupsView}
                baseCurrency={base}
                metric="expense"
                complement={{ label: 'Ingresos', value: totals.income }}
                showLegend={false}
              />
              <GroupBreakdown groups={expenseGroupsView} baseCurrency={base} metric="expense" />
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Ingresos por persona</h2>
              <DonutChart
                groups={incomeGroupsView}
                baseCurrency={base}
                metric="income"
                complement={{ label: 'Gastos', value: totals.expense }}
                complementPosition="start"
                showLegend={false}
              />
              <GroupBreakdown groups={incomeGroupsView} baseCurrency={base} metric="income" />
            </div>
          </section>

          {/* [4] DETALLE — filtros apilables (persona/banco/medio/categoría). Sin filtro = todo el
              mes (nunca vacío). Acá sí se ven los no-miembros individualmente. */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Detalle por filtro</h2>
            <ReportFilterBar filters={filters} options={filterOptions} onChange={setFilters} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="text-muted-foreground">{detailLabel} · gasto total: </span>
                <span className="font-semibold">{formatAmount(detailTotal, base)}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ver por</span>
                <ReportTabs value={detailDimension} onChange={setDetailDimension} />
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div className="space-y-3">
                {detailDimension === 'persona' ? (
                  <PersonaBreakdown people={detailPersonas} baseCurrency={base} aliasing={personaAliasing} />
                ) : (
                  <GroupBreakdown groups={detailGroups} baseCurrency={base} />
                )}
                {detailDimension === 'persona' && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {detailPersonas.map((person) => (
                      <li key={person.holder}>
                        <span className="font-medium text-foreground">
                          {displayPersonaLabel(person.key, person.holder, aliases)}:
                        </span>{' '}
                        {(personaInfo.get(person.holder) ?? [])
                          .map(
                            (acc) =>
                              acc.accountName +
                              (acc.isExtension && acc.titularHolderName
                                ? ` (ext. de ${acc.titularHolderName})`
                                : ''),
                          )
                          .join(', ') || 'sin medios cargados'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DonutChart groups={detailGroups} baseCurrency={base} showLegend={false} />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Mes a mes</h2>
            <BarChart series={series} baseCurrency={base} />
          </section>

          {/* ANUAL — acumulado del año en curso hasta el mes activo. */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Anual — {year} (acumulado a la fecha)</h2>
            <ConsolidatedTotals consolidated={yearTotals} baseCurrency={base} />
            <BarChart series={yearSeries} baseCurrency={base} />
          </section>
        </>
      )}
    </div>
  );
}
