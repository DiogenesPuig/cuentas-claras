import { useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { attachmentViewerMode } from '../attachment';
import { useAttachmentUrl } from '../hooks';

interface AttachmentViewerProps {
  attachmentId: string;
}

/**
 * Visor de un comprobante (F2-7): botón "Ver comprobante" que, al abrirse, pide la signed URL
 * on-demand y muestra la imagen inline o un link de ver/descargar si es PDF. Si la URL vence,
 * permite reintentar. No se renderiza si el movimiento no tiene `attachment_id`.
 */
export function AttachmentViewer({ attachmentId }: AttachmentViewerProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useAttachmentUrl(attachmentId, open);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Paperclip className="size-3.5" aria-hidden="true" />
        Ver comprobante
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs font-medium text-muted-foreground hover:underline"
      >
        Ocultar comprobante
      </button>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando comprobante…</p>}

      {isError && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span>No se pudo cargar el comprobante (puede haber vencido el enlace).</span>
          <button type="button" onClick={() => void refetch()} className="font-medium underline">
            Reintentar
          </button>
        </div>
      )}

      {data && attachmentViewerMode(data.fileType) === 'image' && (
        <img
          src={data.url}
          alt="Comprobante adjunto al movimiento"
          className="max-h-64 max-w-full rounded-md border border-border"
        />
      )}

      {data && attachmentViewerMode(data.fileType) === 'pdf' && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <FileText className="size-3.5" aria-hidden="true" />
          Ver/Descargar PDF
        </a>
      )}
    </div>
  );
}
