// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { HistoryDialogComponent, HistoryDialogData } from './history-dialog.component';
import * as clipboardUtil from '../../../../../shared/utils/clipboard.util';
import type { HistoryEntry, HistoryState } from '../../../types/history.types';

describe('HistoryDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockHistoryService: { clearHistory: ReturnType<typeof vi.fn> };

  function makeEntry(id: string): HistoryEntry {
    return {
      id,
      timestamp: 1_700_000_000_000,
      operationType: 'add-node',
      description: `entry ${id}`,
      cells: [],
      previousCells: [],
      metadata: { affectedCellIds: [] },
    } as unknown as HistoryEntry;
  }

  function makeState(undo: HistoryEntry[], redo: HistoryEntry[]): HistoryState {
    return {
      undoStack: undo,
      redoStack: redo,
      maxStackSize: 50,
      currentIndex: undo.length,
    };
  }

  function build(state: HistoryState): HistoryDialogComponent {
    const data: HistoryDialogData = {
      historyState: state,
      historyService: mockHistoryService as never,
    };
    return new HistoryDialogComponent(mockDialogRef as never, data);
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockHistoryService = { clearHistory: vi.fn() };
    vi.restoreAllMocks();
  });

  describe('summary', () => {
    it('reports stack sizes and undo/redo availability', () => {
      const component = build(makeState([makeEntry('a'), makeEntry('b')], [makeEntry('c')]));

      expect(component.summary.undoStackSize).toBe(2);
      expect(component.summary.redoStackSize).toBe(1);
      expect(component.summary.canUndo).toBe(true);
      expect(component.summary.canRedo).toBe(true);
    });

    it('reports no undo/redo for an empty history', () => {
      const component = build(makeState([], []));

      expect(component.summary.canUndo).toBe(false);
      expect(component.summary.canRedo).toBe(false);
    });
  });

  describe('processed stacks', () => {
    it('builds a processed entry per undo/redo stack item', () => {
      const component = build(makeState([makeEntry('a')], [makeEntry('b'), makeEntry('c')]));

      expect(component.undoStack).toHaveLength(1);
      expect(component.redoStack).toHaveLength(2);
      expect(component.undoStack[0].id).toBe('a');
      expect(component.undoStack[0].operationType).toBe('add-node');
    });
  });

  describe('onCopyToClipboard', () => {
    it('copies the serialized history JSON', () => {
      const spy = vi.spyOn(clipboardUtil, 'copyToClipboard').mockImplementation(() => undefined);
      const component = build(makeState([makeEntry('a')], []));

      component.onCopyToClipboard();

      expect(spy).toHaveBeenCalledWith(component.historyJson);
    });
  });

  describe('onClearHistory', () => {
    it('clears the history via the service and closes the dialog', () => {
      const component = build(makeState([makeEntry('a')], []));

      component.onClearHistory();

      expect(mockHistoryService.clearHistory).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      const component = build(makeState([], []));

      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
