import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { displayToIsoDate, isoToDisplayDate } from '@/features/transactions/format';

interface DateFieldProps {
  id: string;
  label: string;
  /** Fecha en display `DD/MM/AAAA` (puede estar incompleta mientras se tipea). */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  optionalHint?: boolean;
}

/** ISO `YYYY-MM-DD` → `Date` local a medianoche (evita el corrimiento de un día por UTC). */
function isoToLocalDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** `Date` local → ISO `YYYY-MM-DD`, leyendo año/mes/día locales (no UTC). */
function localDateToIso(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Alto de arranque (antes de poder medir el panel real) para la primera pasada. */
const FALLBACK_PANEL_HEIGHT = 360;

interface Position {
  top: number;
  right: number;
}

/**
 * Input de fecha `DD/MM/AAAA` (se puede seguir tipeando a mano) con un calendario
 * (shadcn/ui sobre `react-day-picker`) para elegirla visualmente (MEJ-1).
 *
 * El calendario se porta a `document.body` con `position: fixed` (en vez de vivir dentro del
 * formulario): así, al abrirse dentro de un modal con scroll propio, no le agrega scroll ni
 * cambia su tamaño (queda completamente fuera de ese flujo).
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled,
  optionalHint,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function computePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // La 1ª pasada (el panel todavía no montó) usa un alto de arranque; el `requestAnimationFrame`
      // de abajo la corrige ya con el alto real medido, antes de que el navegador pinte.
      const panelHeight = panelRef.current?.getBoundingClientRect().height ?? FALLBACK_PANEL_HEIGHT;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < panelHeight && rect.top > spaceBelow;
      setPosition({
        top: openUpward ? rect.top - panelHeight - 4 : rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    computePosition();
    const raf = requestAnimationFrame(computePosition);
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectedIso = displayToIsoDate(value);
  const selectedDate = selectedIso ? isoToLocalDate(selectedIso) : undefined;

  return (
    <div className="space-y-1" ref={containerRef}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optionalHint && ' (opcional)'}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder ?? 'DD/MM/AAAA'}
          disabled={disabled}
          className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          aria-label={`Elegir ${label.toLowerCase()} en el calendario`}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, right: position.right }}
            className="fixed z-50 rounded-md border border-input bg-muted shadow-lg"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={(date) => {
                if (!date) return;
                onChange(isoToDisplayDate(localDateToIso(date)));
                setOpen(false);
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
