import { displayPersonaLabel, type AliasMap } from '@/features/aliases';
import { formatAmount } from '@/features/transactions/format';
import type {
  DimensionGroup,
  PersonaAccountInfo,
  PersonaSpending,
  ReportDimension,
  ReportFilters,
} from '../aggregate';
import { DonutChart } from './DonutChart';
import { GroupBreakdown } from './GroupBreakdown';
import { PersonaBreakdown, type PersonaAliasing } from './PersonaBreakdown';
import { ReportFilterBar, type ReportFilterOptions } from './ReportFilterBar';
import { ReportTabs } from './ReportTabs';

interface ReportsDetailSectionProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  filterOptions: ReportFilterOptions;
  detailDimension: ReportDimension;
  onDetailDimensionChange: (dimension: ReportDimension) => void;
  detailLabel: string;
  detailTotal: number;
  baseCurrency: string;
  detailGroups: DimensionGroup[];
  detailPersonas: PersonaSpending[];
  personaInfo: Map<string, PersonaAccountInfo[]>;
  personaAliasing: PersonaAliasing;
  aliases: AliasMap;
}

/**
 * [4] "Detalle por filtro" de `/reportes`: filtros apilables recortan el subconjunto del mes
 * (sin filtro = todo el mes) y se ve su desglose por la dimensión elegida ("ver por"). A
 * diferencia de `ReportsSummarySection`, acá NO se colapsan no-miembros.
 */
export function ReportsDetailSection({
  filters,
  onFiltersChange,
  filterOptions,
  detailDimension,
  onDetailDimensionChange,
  detailLabel,
  detailTotal,
  baseCurrency,
  detailGroups,
  detailPersonas,
  personaInfo,
  personaAliasing,
  aliases,
}: ReportsDetailSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Detalle por filtro</h2>
      <ReportFilterBar filters={filters} options={filterOptions} onChange={onFiltersChange} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="text-muted-foreground">{detailLabel} · gasto total: </span>
          <span className="font-semibold">{formatAmount(detailTotal, baseCurrency)}</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ver por</span>
          <ReportTabs value={detailDimension} onChange={onDetailDimensionChange} />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="space-y-3">
          {detailDimension === 'persona' ? (
            <PersonaBreakdown people={detailPersonas} baseCurrency={baseCurrency} aliasing={personaAliasing} />
          ) : (
            <GroupBreakdown groups={detailGroups} baseCurrency={baseCurrency} />
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
                        (acc.isExtension && acc.titularHolderName ? ` (ext. de ${acc.titularHolderName})` : ''),
                    )
                    .join(', ') || 'sin medios cargados'}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DonutChart groups={detailGroups} baseCurrency={baseCurrency} showLegend={false} />
      </div>
    </section>
  );
}
