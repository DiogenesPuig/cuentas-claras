import { describe, expect, it } from 'vitest';
import { attachmentViewerMode } from './attachment';

describe('attachmentViewerMode', () => {
  it('renders image type inline', () => {
    expect(attachmentViewerMode('image')).toBe('image');
  });

  it('renders pdf type as a link', () => {
    expect(attachmentViewerMode('pdf')).toBe('pdf');
  });

  it('falls back to pdf mode for unexpected values', () => {
    expect(attachmentViewerMode('weird')).toBe('pdf');
  });
});
