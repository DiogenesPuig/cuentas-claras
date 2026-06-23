import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentViewer } from './AttachmentViewer';

const useAttachmentUrl = vi.fn();

vi.mock('../hooks', () => ({
  useAttachmentUrl: (attachmentId: string | null, enabled: boolean) =>
    useAttachmentUrl(attachmentId, enabled),
}));

describe('AttachmentViewer', () => {
  it('no pide la signed URL hasta que se abre el visor', () => {
    useAttachmentUrl.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    render(<AttachmentViewer attachmentId="att-1" />);

    expect(useAttachmentUrl).toHaveBeenCalledWith('att-1', false);
    expect(screen.getByRole('button', { name: /Ver comprobante/ })).toBeInTheDocument();
  });

  it('muestra la imagen inline cuando el comprobante es una imagen', async () => {
    useAttachmentUrl.mockReturnValue({
      data: { url: 'https://signed.example/img.jpg', fileType: 'image' },
      isLoading: false,
      isError: false,
    });
    render(<AttachmentViewer attachmentId="att-1" />);

    await userEvent.click(screen.getByRole('button', { name: /Ver comprobante/ }));

    expect(useAttachmentUrl).toHaveBeenCalledWith('att-1', true);
    expect(screen.getByRole('img', { name: /Comprobante/ })).toHaveAttribute(
      'src',
      'https://signed.example/img.jpg',
    );
  });

  it('ofrece ver/descargar cuando el comprobante es un PDF', async () => {
    useAttachmentUrl.mockReturnValue({
      data: { url: 'https://signed.example/doc.pdf', fileType: 'pdf' },
      isLoading: false,
      isError: false,
    });
    render(<AttachmentViewer attachmentId="att-1" />);

    await userEvent.click(screen.getByRole('button', { name: /Ver comprobante/ }));

    expect(screen.getByRole('link', { name: /Ver\/Descargar PDF/ })).toHaveAttribute(
      'href',
      'https://signed.example/doc.pdf',
    );
  });

  it('permite reintentar si la signed URL venció', async () => {
    const refetch = vi.fn();
    useAttachmentUrl.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<AttachmentViewer attachmentId="att-1" />);

    await userEvent.click(screen.getByRole('button', { name: /Ver comprobante/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(refetch).toHaveBeenCalled();
  });
});
