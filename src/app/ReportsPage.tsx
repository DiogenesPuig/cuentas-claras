import { useMemo, useState } from 'react';
import { useAccounts } from '@/features/accounts';
import {
  BarChart,
  ConsolidatedTotals,
  DonutChart,
  GroupBreakdown,
  PersonaBreakdown,
  ReportFilterBar,
  ReportTabs,
  aggregateByDimension,
  consolidateTransactions,
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

  // Vista GENERAL (todo el grupo, sin filtrar): totales, desglose por dimensión y mes a mes.
  const groups = aggregateByDimension(monthTransactions, dimension, base, rateFor);
  const totals = consolidateTransactions(monthTransactions, base, rateFor);
  const series = monthlySeries(allTransactions, months, base, rateFor);
  const personaInfo = personaAccounts(accounts ?? []);
  const personas = personaSpending(monthTransactions, base, rateFor);

  // Opciones del filtro de detalle, a partir de lo que hay en el mes (FR-22).
  const distinct = (values: (string | null | undefined)[], fallback: string) =>
    Array.from(new Set(values.map((v) => v ?? fallback))).sort((a, b) => a.localeCompare(b, 'es'));
  const filterOptions: ReportFilterOptions = {
    persona: distinct(monthTransactions.map((tx) => tx.account?.holder_name), 'Sin medio'),
    banco: distinct(monthTransactions.map((tx) => tx.account?.bank), 'Sin medio'),
    medio: distinct(monthTransactions.map((tx) => tx.account?.name), 'Sin medio'),
    categoria: distinct(monthTransactions.map((tx) => tx.category?.name), 'Sin categoría'),
  };

  // Vista DE DETALLE (abajo): los filtros (apilables) recortan el subconjunto y se ve su
  // desglose por la dimensión elegida. Vacío hasta que haya algún filtro activo.
  const hasFilter = Boolean(filters.persona || filters.banco || filters.medio || filters.categoria);
  const detailTxs = filterReportTransactions(monthTransactions, filters);
  const detailGroups = aggregateByDimension(detailTxs, detailDimension, base, rateFor);
  const detailTotal = consolidateTransactions(detailTxs, base, rateFor).expense;
  const detailLabel =
    [filters.persona, filters.banco, filters.medio, filters.categoria].filter(Boolean).join(' · ') ||
    'Filtrado';

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
          <ConsolidatedTotals consolidated={totals} baseCurrency={base} />

          {/* GENERAL — todo el grupo. Gráfico a la izquierda, info a la derecha. */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">General — todo el grupo</h2>
            <ReportTabs value={dimension} onChange={setDimension} />
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <DonutChart groups={groups} baseCurrency={base} showLegend={false} />
              <div className="space-y-3">
                {dimension === 'persona' ? (
                  <PersonaBreakdown people={personas} baseCurrency={base} />
                ) : (
                  <GroupBreakdown groups={groups} baseCurrency={base} />
                )}
                {dimension === 'persona' && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {personas.map((person) => (
                      <li key={person.holder}>
                        <span className="font-medium text-foreground">{person.holder}:</span>{' '}
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
            </div>
          </section>

          {/* DETALLE — filtros apilables (persona/banco/medio/categoría). Info a la izquierda,
              gráfico a la derecha (invertido respecto del general). Vacío hasta filtrar. */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Detalle por filtro</h2>
            <ReportFilterBar filters={filters} options={filterOptions} onChange={setFilters} />
            {hasFilter ? (
              <>
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
                  <GroupBreakdown groups={detailGroups} baseCurrency={base} />
                  <DonutChart groups={detailGroups} baseCurrency={base} showLegend={false} />
                </div>
              </>
            ) : (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Elegí una persona, banco, medio o categoría para ver acá su desglose. Podés apilar
                filtros (ej. Persona + Restaurantes) y sacarlos con "Limpiar".
              </p>
            )}
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
