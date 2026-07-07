import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Título del diálogo (accesibilidad + encabezado visible). */
  title?: string;
  children: ReactNode;
}

/**
 * Modal genérico: portal a `document.body` (para que el overlay `fixed` tome el viewport
 * sin importar ancestros con `backdrop-filter`/`transform` — ver BUG-11), overlay que cierra
 * al clickear afuera, cierre con Escape y panel con scroll propio si el contenido es largo.
 * En mobile aparece como bottom-sheet; en desktop, centrado.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-lg bg-background p-4 shadow-lg sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
