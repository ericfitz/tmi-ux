// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Graph } from '@antv/x6';

import { ClipboardDialogComponent } from './clipboard-dialog.component';
import * as clipboardUtil from '../../../../../shared/utils/clipboard.util';

describe('ClipboardDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    vi.restoreAllMocks();
  });

  it('reports an empty clipboard', () => {
    const graph = {
      isClipboardEmpty: () => true,
      getCellsInClipboard: () => [],
    } as unknown as Graph;

    const component = new ClipboardDialogComponent(mockDialogRef as never, { graph });

    expect(component.clipboardJson).toContain('"isEmpty": true');
    expect(component.clipboardJson).toContain('"cellCount": 0');
  });

  it('serializes the cells currently in the clipboard', () => {
    const graph = {
      isClipboardEmpty: () => false,
      getCellsInClipboard: () => [
        { id: 'n1', shape: 'process', isNode: () => true, isEdge: () => false },
      ],
    } as unknown as Graph;

    const component = new ClipboardDialogComponent(mockDialogRef as never, { graph });

    expect(component.clipboardJson).toContain('"cellCount": 1');
    expect(component.clipboardJson).toContain('n1');
    expect(component.clipboardJson).toContain('"type": "node"');
  });

  describe('onCopyToClipboard', () => {
    it('copies the serialized JSON via the clipboard util', () => {
      const spy = vi.spyOn(clipboardUtil, 'copyToClipboard').mockImplementation(() => undefined);
      const graph = {
        isClipboardEmpty: () => true,
        getCellsInClipboard: () => [],
      } as unknown as Graph;
      const component = new ClipboardDialogComponent(mockDialogRef as never, { graph });

      component.onCopyToClipboard();

      expect(spy).toHaveBeenCalledWith(component.clipboardJson);
    });
  });

  describe('onClearClipboard', () => {
    it('cleans the X6 clipboard and closes the dialog', () => {
      const cleanClipboard = vi.fn();
      const graph = {
        isClipboardEmpty: () => false,
        getCellsInClipboard: () => [],
        cleanClipboard,
      } as unknown as Graph;
      const component = new ClipboardDialogComponent(mockDialogRef as never, { graph });

      component.onClearClipboard();

      expect(cleanClipboard).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      const graph = {
        isClipboardEmpty: () => true,
        getCellsInClipboard: () => [],
      } as unknown as Graph;
      const component = new ClipboardDialogComponent(mockDialogRef as never, { graph });

      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
