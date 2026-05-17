import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmDialogService } from './tm-dialog.service';

describe('TmDialogService', () => {
  let service: TmDialogService;
  let afterClosed: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    afterClosed = vi.fn().mockReturnValue(of('RESULT'));
    open = vi.fn().mockReturnValue({ afterClosed });
    service = new TmDialogService({ open } as never);
  });

  it('openDocumentEditor opens DocumentEditorDialogComponent with width 600px and disableClose', () => {
    const data = { mode: 'create' } as never;
    service.openDocumentEditor(data).subscribe();
    expect(open).toHaveBeenCalledTimes(1);
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('600px');
    expect(config.disableClose).toBe(true);
    expect(config.data).toBe(data);
    expect(afterClosed).toHaveBeenCalled();
  });

  it('openDeleteConfirmation opens DeleteConfirmationDialogComponent with width 700px and disableClose', () => {
    const data = { id: 'd1', name: 'Doc', objectType: 'document' } as never;
    service.openDeleteConfirmation(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('700px');
    expect(config.disableClose).toBe(true);
    expect(config.data).toBe(data);
  });

  it('openMetadata opens MetadataDialogComponent with the documented sizing', () => {
    const data = {
      metadata: [],
      isReadOnly: false,
      objectType: 'Document',
      objectName: 'x',
    } as never;
    service.openMetadata(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('90vw');
    expect(config.maxWidth).toBe('800px');
    expect(config.minWidth).toBe('500px');
    expect(config.maxHeight).toBe('80vh');
    expect(config.data).toBe(data);
    expect(config.disableClose).toBeUndefined();
  });

  it('forwards the afterClosed() observable result', () => {
    let received: unknown;
    service.openDocumentEditor({} as never).subscribe(r => (received = r));
    expect(received).toBe('RESULT');
  });
});
