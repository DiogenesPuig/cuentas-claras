export type AttachmentViewerMode = 'image' | 'pdf';

/** Mapea `file_type` ('image' | 'pdf', u otro valor inesperado) al modo de render del visor. */
export function attachmentViewerMode(fileType: string): AttachmentViewerMode {
  return fileType === 'image' ? 'image' : 'pdf';
}
