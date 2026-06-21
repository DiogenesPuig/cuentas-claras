import { useMemo, useState } from 'react';
import { useAccounts } from '@/features/accounts';
import {
  BarChart,
  ConsolidatedTotals,
  DonutChart,
  ReportTabs,
  aggregateByDimension,
  consolidateTransactions,
  monthlySeries,
  personaAccounts,
  useFxRates,
  useReportTransactions,
  useWorkspaceFxSettings,
  type ReportDimension,
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

  const groups = aggregateByDimension(monthTransactions, dimension, base, rateFor);
  const totals = consolidateTransactions(monthTransactions, base, rateFor);
  const series = monthlySeries(allTransactions, months, base, rateFor);
  const personaInfo = personaAccounts(accounts ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
      <p className="text-sm text-muted-foreground">{formatMonthLabel(activeMonth)}</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <ConsolidatedTotals consolidated={totals} baseCurrency={base} />

          <div className="space-y-3">
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
