import { useMemo, useState } from 'react';
import { useAccounts } from '@/features/accounts';
import {
  BarChart,
  ConsolidatedTotals,
  DonutChart,
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
  const [dimension, setDimension] = useState<ReportDimension>('categoria');
  const [filters, setFilters] = useState<ReportFilters>({});

  const months = useMemo(
    () => Array.from({ length: MONTHS_WINDOW }, (_, i) => shiftMonth(activeMonth, i - (MONTHS_WINDOW - 1))),
    [activeMonth],
  );
  const range = useMemo(
    () => ({ from: `${months[0]}-01`, to: `${shiftMonth(activeMonth, 1)}-01` }),
    [months, activeMonth],
  );

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

  // Opciones de filtro a partir de lo que hay en el mes (FR-22).
  const distinct = (values: (string | null | undefined)[], fallback: string) =>
    Array.from(new Set(values.map((v) => v ?? fallback))).sort((a, b) => a.localeCompare(b, 'es'));
  const filterOptions: ReportFilterOptions = {
    persona: distinct(monthTransactions.map((tx) => tx.account?.holder_name), 'Sin medio'),
    categoria: distinct(monthTransactions.map((tx) => tx.category?.name), 'Sin categoría'),
    medio: distinct(monthTransactions.map((tx) => tx.account?.name), 'Sin medio'),
  };

  // Filtros combinables (persona/categoría/medio) aplicados al período y a la serie.
  const filtered = filterReportTransactions(monthTransactions, filters);
  const filteredAll = filterReportTransactions(allTransactions, filters);

  const groups = aggregateByDimension(filtered, dimension, base, rateFor);
  const totals = consolidateTransactions(filtered, base, rateFor);
  const series = monthlySeries(filteredAll, months, base, rateFor);
  const personaInfo = personaAccounts(accounts ?? []);
  const personas = personaSpending(filtered, base, rateFor);
  const personaGroups = aggregateByDimension(filtered, 'persona', base, rateFor);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
      <p className="text-sm text-muted-foreground">{formatMonthLabel(activeMonth)}</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <ReportFilterBar filters={filters} options={filterOptions} onChange={setFilters} />

          <ConsolidatedTotals consolidated={totals} baseCurrency={base} />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Gasto por persona</h2>
            <DonutChart groups={personaGroups} baseCurrency={base} />
            <PersonaBreakdown people={personas} baseCurrency={base} />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Desglose</h2>
            <ReportTabs value={dimension} onChange={setDimension} />
            <DonutChart groups={groups} baseCurrency={base} />

            {dimension === 'persona' && (
              <ul className="space-y-2 text-sm">
                {groups.map((group) => (
                  <li key={group.key}>
                    <span className="font-medium">{group.key}</span>
                    <ul className="ml-4 text-xs text-muted-foreground">
                      {(personaInfo.get(group.key) ?? []).map((acc) => (
                        <li key={acc.accountName}>
                          {acc.accountName}
                          {acc.isExtension && acc.titularHolderName
                            ? ` (extensión de ${acc.titularHolderName})`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Mes a mes</h2>
            <BarChart series={series} baseCurrency={base} />
          </div>
        </>
      )}
    </div>
  );
}
