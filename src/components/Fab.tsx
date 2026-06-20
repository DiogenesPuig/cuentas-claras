import { Plus } from 'lucide-react';

interface FabProps {
  onClick: () => void;
  label?: string;
}

/** Botón flotante de acción principal (alta rápida de movimiento). */
export function Fab({ onClick, label = 'Nuevo movimiento' }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring md:bottom-6"
    >
      <Plus className="h-6 w-6" aria-hidden />
    </button>
  );
}
