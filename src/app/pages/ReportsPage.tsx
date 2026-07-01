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
  ConsolidatedTotals,
  ReportsDetailSection,
  ReportsSummarySection,
  ReportsTrendsSection,
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
import { buildRateIndex, lookupRate } from '@/lib/fx';
import { useActiveMonth, formatMonthLabel, shiftMonth } from '@/hooks/useActiveMonth';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

/** Cantidad de meses (incluido el activo) que entran en la comparativa mes a mes (FR-24). */
const MONTHS_WINDOW = 6;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function distinct(values: (string | null | undefined)[], fallback: string): string[] {
  return Array.from(new Set(values.map((v) => v ?? fallback))).sort((a, b) => a.localeCompare(b, 'es'));
}

function aliasGroups(groups: DimensionGroup[], aliases: AliasMap): DimensionGroup[] {
  return groups.map((g) => ({ ...g, label: displayPersonaLabel(g.key, g.label, aliases) }));
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

  const base = fxSettings?.baseCurrency ?? 'ARS';
  const allTransactions = useMemo(() => transactions ?? [], [transactions]);

  const monthTransactions = useMemo(
    () => allTransactions.filter((tx) => tx.occurred_on.startsWith(activeMonth)),
    [allTransactions, activeMonth],
  );

  // RESUMEN del mes (MEJ-5): totales macro + donut de gastos y donut de ingresos separados.
  const totals = useMemo(
    () => consolidateTransactions(monthTransactions, base, rateFor),
    [monthTransactions, base, rateFor],
  );
  // [2] Gastos por la dimensión elegida; en "persona" se colapsan los no-miembros en "Otros".
  const expenseGroups = useMemo(
    () =>
      dimension === 'persona'
        ? aggregateByPersonaMembersOnly(monthTransactions, base, rateFor, memberNameById)
        : aggregateByDimension(monthTransactions, dimension, base, rateFor, memberNameById),
    [dimension, monthTransactions, base, rateFor, memberNameById],
  );
  // [3] Ingresos por persona, SOLO miembros (los no-miembros caen en "Otros").
  const incomeGroups = useMemo(
    () => aggregateByPersonaMembersOnly(monthTransactions, base, rateFor, memberNameById),
    [monthTransactions, base, rateFor, memberNameById],
  );
  const series = useMemo(
    () => monthlySeries(allTransactions, months, base, rateFor),
    [allTransactions, months, base, rateFor],
  );

  // Apodos (MEJ-8): pisan el label de cada grupo de persona (display-only; no afecta agrupación).
  const aliases: AliasMap = useMemo(() => aliasData ?? {}, [aliasData]);
  // En gastos solo aplica cuando el desglose es por persona; en ingresos siempre es por persona.
  const expenseGroupsView = useMemo(
    () => (dimension === 'persona' ? aliasGroups(expenseGroups, aliases) : expenseGroups),
    [dimension, expenseGroups, aliases],
  );
  const incomeGroupsView = useMemo(
    () => aliasGroups(incomeGroups, aliases),
    [incomeGroups, aliases],
  );

  // Opciones del filtro de detalle, a partir de lo que hay en el mes (FR-22).
  const filterOptions = useMemo<ReportFilterOptions>(
    () => ({
      persona: distinct(
        monthTransactions.map((tx) => dimensionLabelFor('persona', tx, memberNameById)),
        'Sin medio',
      ),
      banco: distinct(monthTransactions.map((tx) => tx.bank ?? tx.account?.bank), 'Sin medio'),
      medio: distinct(monthTransactions.map((tx) => tx.account?.name), 'Sin medio'),
      categoria: distinct(monthTransactions.map((tx) => tx.category?.name), 'Sin categoría'),
    }),
    [monthTransactions, memberNameById],
  );

  // [4] DETALLE por filtro: los filtros (apilables) recortan el subconjunto y se ve su desglose
  // por la dimensión elegida. Sin filtro = todo el mes (nunca vacío). A diferencia de los donut
  // de resumen, acá NO se colapsan no-miembros: un titular ajeno puntual sí se puede ver.
  const activeFilterValues = [
    ...(filters.persona ?? []),
    ...(filters.banco ?? []),
    ...(filters.medio ?? []),
    ...(filters.categoria ?? []),
  ];
  const detailTxs = useMemo(
    () => filterReportTransactions(monthTransactions, filters, memberNameById),
    [monthTransactions, filters, memberNameById],
  );
  const detailGroups = useMemo(
    () => aggregateByDimension(detailTxs, detailDimension, base, rateFor, memberNameById),
    [detailTxs, detailDimension, base, rateFor, memberNameById],
  );
  // Apodos en el donut del detalle (BUG-6): solo cuando el desglose es por persona, igual que
  // `expenseGroupsView`. Sin esto, la lista mostraba el apodo pero el donut el nombre real.
  const detailGroupsView = useMemo(
    () => (detailDimension === 'persona' ? aliasGroups(detailGroups, aliases) : detailGroups),
    [detailDimension, detailGroups, aliases],
  );
  const detailTotal = useMemo(
    () => consolidateTransactions(detailTxs, base, rateFor).expense,
    [detailTxs, base, rateFor],
  );
  // Solo se usa (y se muestra) cuando el detalle se ve "por persona" (JSX más abajo); evitar el
  // costo de personaSpending (O(miembros × n)) el resto de las veces (REF-1, perf).
  const detailPersonas = useMemo(
    () => (detailDimension === 'persona' ? personaSpending(detailTxs, base, rateFor, memberNameById) : []),
    [detailDimension, detailTxs, base, rateFor, memberNameById],
  );
  const personaInfo = useMemo(
    () => personaAccounts(accounts ?? [], memberNameById),
    [accounts, memberNameById],
  );
  const detailLabel = activeFilterValues.join(' · ') || 'Todo el mes';

  // Apodos en la lista por persona del detalle (MEJ-8): mostrar + editar inline.
  const personaAliasing = {
    labelFor: (key: string, baseLabel: string) => displayPersonaLabel(key, baseLabel, aliases),
    onSave: (key: string, alias: string) => upsertAlias.mutate({ personaKey: key, alias }),
    onClear: (key: string) => deleteAlias.mutate(key),
  };

  // Vista ANUAL (acumulado del año hasta el mes activo).
  const yearTransactions = useMemo(
    () => allTransactions.filter((tx) => tx.occurred_on.startsWith(year)),
    [allTransactions, year],
  );
  const yearTotals = useMemo(
    () => consolidateTransactions(yearTransactions, base, rateFor),
    [yearTransactions, base, rateFor],
  );
  const yearSeries = useMemo(
    () => monthlySeries(allTransactions, yearMonths, base, rateFor),
    [allTransactions, yearMonths, base, rateFor],
  );

  if (!workspaceId) return null;

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
          <ReportsSummarySection
            dimension={dimension}
            onDimensionChange={setDimension}
            expenseGroups={expenseGroupsView}
            incomeGroups={incomeGroupsView}
            totals={totals}
            baseCurrency={base}
          />

          {/* [4] DETALLE — filtros apilables (persona/banco/medio/categoría). Sin filtro = todo el
              mes (nunca vacío). Acá sí se ven los no-miembros individualmente. */}
          <ReportsDetailSection
            filters={filters}
            onFiltersChange={setFilters}
            filterOptions={filterOptions}
            detailDimension={detailDimension}
            onDetailDimensionChange={setDetailDimension}
            detailLabel={detailLabel}
            detailTotal={detailTotal}
            baseCurrency={base}
            detailGroups={detailGroupsView}
            detailPersonas={detailPersonas}
            personaInfo={personaInfo}
            personaAliasing={personaAliasing}
            aliases={aliases}
          />

          {/* MES A MES + ANUAL (acumulado del año en curso hasta el mes activo). */}
          <ReportsTrendsSection
            series={series}
            yearSeries={yearSeries}
            yearTotals={yearTotals}
            baseCurrency={base}
            year={year}
          />
        </>
      )}
    </div>
  );
}
