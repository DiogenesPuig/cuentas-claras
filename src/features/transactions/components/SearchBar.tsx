interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Búsqueda por texto del motivo del movimiento (FR-11). El debounce lo maneja quien la usa. */
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Buscar por motivo…"
      aria-label="Buscar movimientos por motivo"
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    />
  );
}
