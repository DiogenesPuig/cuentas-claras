import { CreditCard, Home, ListChecks, PieChart, Tags, Users, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Sólo la ruta índice debe matchear de forma exacta. */
  end?: boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/medios', label: 'Medios', icon: CreditCard },
  { to: '/movimientos', label: 'Movimientos', icon: ListChecks },
  { to: '/reportes', label: 'Reportes', icon: PieChart },
  { to: '/grupo', label: 'Grupo', icon: Users },
];

/**
 * Navegación principal. En mobile es una barra inferior fija; en desktop (md+)
 * pasa a ser una sidebar vertical.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-background',
        'md:static md:w-56 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-3',
      )}
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground transition-colors',
              'md:flex-none md:flex-row md:gap-3 md:rounded-md md:px-3 md:py-2 md:text-sm',
              'hover:text-foreground md:hover:bg-accent',
              isActive && 'text-primary md:bg-accent md:text-foreground',
            )
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
