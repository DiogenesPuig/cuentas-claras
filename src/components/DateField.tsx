import { useEffect, useRef, useState } from 'react';
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

/**
 * Input de fecha `DD/MM/AAAA` (se puede seguir tipeando a mano) con un calendario
 * (shadcn/ui sobre `react-day-picker`) para elegirla visualmente (MEJ-1).
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
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
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

  // Al abrir, el calendario puede quedar tapado por el borde del modal/página (hay que scrollear
  // para verlo entero); lo traemos a la vista solo lo necesario, sin saltar la página entera.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.scrollIntoView?.({ block: 'nearest' });
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
        {open && (
          <div
            ref={panelRef}
            className="absolute right-0 top-full z-20 mt-1 rounded-md border border-input bg-popover shadow-md"
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
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
