import '@angular/compiler';
import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from './blob-download.util';

describe('downloadBlob', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let anchor: HTMLAnchorElement;

  beforeEach(() => {
    clickSpy = vi.fn();
    anchor = document.createElement('a');
    anchor.click = clickSpy;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(
      () => 'blob:mock',
    );
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('triggers an anchor download with the given filename and revokes the url', () => {
    const blob = new Blob(['a,b,c'], { type: 'text/csv' });
    downloadBlob(blob, 'export.csv');
    expect(anchor.download).toBe('export.csv');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
