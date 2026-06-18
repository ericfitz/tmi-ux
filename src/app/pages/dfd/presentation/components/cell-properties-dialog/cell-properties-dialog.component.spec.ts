// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Cell } from '@antv/x6';

import { CellPropertiesDialogComponent } from './cell-properties-dialog.component';
import * as clipboardUtil from '../../../../../shared/utils/clipboard.util';

describe('CellPropertiesDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  /** Build an X6-cell stub whose toJSON returns the given object. */
  // SEM@e81349f7ea7bf60d484b2d87b1182fd5bd360a1f: build a minimal X6 cell stub that serializes to a given JSON object (pure)
  function cellStub(json: object): Cell {
    return { toJSON: () => json } as unknown as Cell;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    vi.restoreAllMocks();
  });

  it('serializes the cell to pretty-printed JSON on construction', () => {
    const cell = cellStub({ id: 'c1', shape: 'process' });
    const component = new CellPropertiesDialogComponent(mockDialogRef as never, { cell });

    expect(component.cellJson).toBe(JSON.stringify({ id: 'c1', shape: 'process' }, null, 2));
  });

  describe('onCopyToClipboard', () => {
    it('copies the serialized JSON via the clipboard util', () => {
      const spy = vi.spyOn(clipboardUtil, 'copyToClipboard').mockImplementation(() => undefined);
      const component = new CellPropertiesDialogComponent(mockDialogRef as never, {
        cell: cellStub({ id: 'c1' }),
      });

      component.onCopyToClipboard();

      expect(spy).toHaveBeenCalledWith(component.cellJson);
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      const component = new CellPropertiesDialogComponent(mockDialogRef as never, {
        cell: cellStub({ id: 'c1' }),
      });

      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
