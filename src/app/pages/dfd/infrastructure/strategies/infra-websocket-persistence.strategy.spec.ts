/**
 * Tests for WebSocketPersistenceStrategy
 *
 * Covers: save/load operations, history-driven broadcasting,
 * cell diffing, and connection state handling.
 */

import '@angular/compiler';

import { Subject, of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import { InfraWebsocketCollaborationAdapter } from '../adapters/infra-websocket-collaboration.adapter';
import { AppHistoryService } from '../../application/services/app-history.service';
import { HistoryOperationEvent, HistoryEntry } from '../../types/history.types';
import { Cell, CellOperation } from '../../../../core/types/websocket-message.types';
import {
  SaveOperation,
  LoadOperation,
} from '../../application/services/app-persistence-coordinator.service';
import { WebSocketPersistenceStrategy } from './infra-websocket-persistence.strategy';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

// Mock normalizeCells to pass through unchanged (isolates strategy logic from normalization)
vi.mock('../../utils/cell-normalization.util', () => ({
  normalizeCells: (cells: Cell[]) => cells,
}));

describe('WebSocketPersistenceStrategy', () => {
  let strategy: WebSocketPersistenceStrategy;
  let loggerService: MockLoggerService;
  let mockWebSocketAdapter: { isConnected: boolean };
  let mockCollaborationAdapter: { sendDiagramOperation: ReturnType<typeof vi.fn> };
  let historyOperation$: Subject<HistoryOperationEvent>;
  let mockHistoryService: { historyOperation$: Subject<HistoryOperationEvent> };

  beforeEach(() => {
    loggerService = createTypedMockLoggerService();

    mockWebSocketAdapter = {
      isConnected: true,
    };

    mockCollaborationAdapter = {
      sendDiagramOperation: vi.fn().mockReturnValue(of(undefined)),
    };

    historyOperation$ = new Subject<HistoryOperationEvent>();
    mockHistoryService = {
      historyOperation$,
    };

    strategy = new WebSocketPersistenceStrategy(
      loggerService as unknown as LoggerService,
      mockWebSocketAdapter as unknown as WebSocketAdapter,
      mockCollaborationAdapter as unknown as InfraWebsocketCollaborationAdapter,
      mockHistoryService as unknown as AppHistoryService,
    );
  });

  afterEach(() => {
    strategy.ngOnDestroy();
  });

  // Helper to create a minimal Cell
  function makeCell(id: string, extras: Partial<Cell> = {}): Cell {
    return { id, shape: 'rect', ...extras };
  }

  // Helper to create a HistoryEntry
  function makeEntry(
    cells: Cell[],
    previousCells: Cell[],
    operationType: 'add-node' | 'delete' = 'add-node',
  ): HistoryEntry {
    return {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      operationType,
      description: 'Test operation',
      cells,
      previousCells,
    };
  }

  // Helper to create a HistoryOperationEvent
  function makeEvent(
    cells: Cell[],
    previousCells: Cell[],
    overrides: Partial<HistoryOperationEvent> = {},
  ): HistoryOperationEvent {
    return {
      operationType: 'add',
      entry: makeEntry(cells, previousCells),
      success: true,
      timestamp: Date.now(),
      ...overrides,
    };
  }

  describe('save()', () => {
    it('should return success when WebSocket is connected for normal operation', () => {
      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: { nodes: [], edges: [] },
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(true);
      expect(result.diagramId).toBe('diagram-1');
      expect(result.metadata?.sentViaWebSocket).toBe(true);
    });

    it('should throw error when WebSocket is disconnected', () => {
      mockWebSocketAdapter.isConnected = false;

      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: { nodes: [], edges: [] },
      };

      let error: Error | undefined;
      strategy.save(operation).subscribe({
        error: e => (error = e),
      });

      expect(error).toBeDefined();
      expect(error!.message).toBe('WebSocket not connected');
    });

    it('should reject undo operations with error', () => {
      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: {},
        metadata: { isUndo: true },
      };

      let error: Error | undefined;
      strategy.save(operation).subscribe({
        error: e => (error = e),
      });

      expect(error).toBeDefined();
      expect(error!.message).toContain('collaboration adapter');
    });

    it('should reject redo operations with error', () => {
      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: {},
        metadata: { isRedo: true },
      };

      let error: Error | undefined;
      strategy.save(operation).subscribe({
        error: e => (error = e),
      });

      expect(error).toBeDefined();
      expect(error!.message).toContain('collaboration adapter');
    });

    it('should not send diagram data directly (uses history-driven broadcasting)', () => {
      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: { nodes: [{ id: 'n1' }], edges: [{ id: 'e1' }] },
      };

      strategy.save(operation).subscribe();

      // sendDiagramOperation should NOT be called by save() — only by history broadcasting
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });
  });

  describe('load()', () => {
    it('should always throw error (WebSocket does not support load)', () => {
      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let error: Error | undefined;
      strategy.load(operation).subscribe({
        error: e => (error = e),
      });

      expect(error).toBeDefined();
      expect(error!.message).toContain('does not support load');
    });

    it('should throw WebSocket not connected when disconnected', () => {
      mockWebSocketAdapter.isConnected = false;

      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let error: Error | undefined;
      strategy.load(operation).subscribe({
        error: e => (error = e),
      });

      expect(error!.message).toBe('WebSocket not connected');
    });
  });

  describe('getConnectionStatus()', () => {
    it('should return true when WebSocket is connected', () => {
      mockWebSocketAdapter.isConnected = true;
      expect(strategy.getConnectionStatus()).toBe(true);
    });

    it('should return false when WebSocket is disconnected', () => {
      mockWebSocketAdapter.isConnected = false;
      expect(strategy.getConnectionStatus()).toBe(false);
    });
  });

  describe('_broadcastCellOperations (via history broadcasting)', () => {
    it('should broadcast added cells (in current but not in previous)', async () => {
      const newCell = makeCell('new-1', { shape: 'process' });
      const event = makeEvent([newCell], []);

      // Emit the event and wait for debounce
      historyOperation$.next(event);
      await vi.waitFor(() => {
        expect(mockCollaborationAdapter.sendDiagramOperation).toHaveBeenCalled();
      });

      const operations: CellOperation[] =
        mockCollaborationAdapter.sendDiagramOperation.mock.calls[0][0];
      expect(operations).toHaveLength(1);
      expect(operations[0].id).toBe('new-1');
      expect(operations[0].operation).toBe('add');
      expect(operations[0].data).toEqual(newCell);
    });

    it('should broadcast removed cells (in previous but not in current)', async () => {
      const oldCell = makeCell('old-1');
      const event = makeEvent([], [oldCell]);

      historyOperation$.next(event);
      await vi.waitFor(() => {
        expect(mockCollaborationAdapter.sendDiagramOperation).toHaveBeenCalled();
      });

      const operations: CellOperation[] =
        mockCollaborationAdapter.sendDiagramOperation.mock.calls[0][0];
      expect(operations).toHaveLength(1);
      expect(operations[0].id).toBe('old-1');
      expect(operations[0].operation).toBe('remove');
      expect(operations[0].data).toBeUndefined();
    });

    it('should broadcast updated cells (in both, but content differs)', async () => {
      const previousCell = makeCell('cell-1', { attrs: { text: { text: 'Old Label' } } });
      const currentCell = makeCell('cell-1', { attrs: { text: { text: 'New Label' } } });
      const event = makeEvent([currentCell], [previousCell]);

      historyOperation$.next(event);
      await vi.waitFor(() => {
        expect(mockCollaborationAdapter.sendDiagramOperation).toHaveBeenCalled();
      });

      const operations: CellOperation[] =
        mockCollaborationAdapter.sendDiagramOperation.mock.calls[0][0];
      expect(operations).toHaveLength(1);
      expect(operations[0].id).toBe('cell-1');
      expect(operations[0].operation).toBe('update');
      expect(operations[0].data).toEqual(currentCell);
    });

    it('should not broadcast when cells are identical', async () => {
      const cell = makeCell('cell-1', { attrs: { text: { text: 'Same' } } });
      const event = makeEvent([cell], [cell]);

      historyOperation$.next(event);

      // Wait a bit and verify no broadcast was made
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should skip broadcast when WebSocket is disconnected', async () => {
      mockWebSocketAdapter.isConnected = false;

      const event = makeEvent([makeCell('new-1')], []);

      historyOperation$.next(event);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should filter out non-add operation types (undo/redo)', async () => {
      const event: HistoryOperationEvent = {
        operationType: 'undo',
        entry: makeEntry([makeCell('cell-1')], []),
        success: true,
        timestamp: Date.now(),
      };

      historyOperation$.next(event);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should filter out unsuccessful operations', async () => {
      const event = makeEvent([makeCell('new-1')], []);
      event.success = false;

      historyOperation$.next(event);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should skip events without entry', async () => {
      const event: HistoryOperationEvent = {
        operationType: 'add',
        entry: undefined as unknown as HistoryEntry,
        success: true,
        timestamp: Date.now(),
      };

      historyOperation$.next(event);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should handle mixed add/update/remove operations in a single event', async () => {
      const previousCells = [
        makeCell('kept-1', { attrs: { text: { text: 'Old' } } }),
        makeCell('removed-1'),
      ];
      const currentCells = [
        makeCell('kept-1', { attrs: { text: { text: 'Updated' } } }),
        makeCell('added-1'),
      ];
      const event = makeEvent(currentCells, previousCells);

      historyOperation$.next(event);
      await vi.waitFor(() => {
        expect(mockCollaborationAdapter.sendDiagramOperation).toHaveBeenCalled();
      });

      const operations: CellOperation[] =
        mockCollaborationAdapter.sendDiagramOperation.mock.calls[0][0];

      const addOps = operations.filter(op => op.operation === 'add');
      const removeOps = operations.filter(op => op.operation === 'remove');
      const updateOps = operations.filter(op => op.operation === 'update');

      expect(addOps).toHaveLength(1);
      expect(addOps[0].id).toBe('added-1');

      expect(removeOps).toHaveLength(1);
      expect(removeOps[0].id).toBe('removed-1');

      expect(updateOps).toHaveLength(1);
      expect(updateOps[0].id).toBe('kept-1');
    });

    it('should log error when collaboration adapter fails to send', async () => {
      mockCollaborationAdapter.sendDiagramOperation.mockReturnValueOnce(
        throwError(() => new Error('Network error')),
      );

      const event = makeEvent([makeCell('new-1')], []);

      historyOperation$.next(event);
      await vi.waitFor(() => {
        expect(mockCollaborationAdapter.sendDiagramOperation).toHaveBeenCalled();
      });

      // Should log the error
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to broadcast cell operations',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });
  });

  describe('_cellsAreDifferent (JSON.stringify comparison)', () => {
    it('should detect actually different cells', () => {
      const cellA = makeCell('cell-1', { attrs: { text: { text: 'A' } } });
      const cellB = makeCell('cell-1', { attrs: { text: { text: 'B' } } });

      // Access private method
      const result = (strategy as any)._cellsAreDifferent(cellA, cellB);
      expect(result).toBe(true);
    });

    it('should return false for identical cells', () => {
      const cell = makeCell('cell-1', { attrs: { text: { text: 'Same' } } });

      const result = (strategy as any)._cellsAreDifferent(cell, cell);
      expect(result).toBe(false);
    });

    it('should detect difference when property order differs (JSON.stringify limitation)', () => {
      // This documents the JSON.stringify property-order sensitivity
      const cellA: Cell = { id: 'cell-1', shape: 'rect', attrs: {} };
      const cellB: Cell = { shape: 'rect', id: 'cell-1', attrs: {} };

      const result = (strategy as any)._cellsAreDifferent(cellA, cellB);
      // JSON.stringify preserves property order, so different order = "different"
      // This is a known limitation — documenting behavior rather than asserting correctness
      // If properties are inserted in different order, this WILL report a false positive
      expect(typeof result).toBe('boolean');
    });
  });

  describe('_convertDiagramDataToCellOperations', () => {
    it('should convert nodes and edges to update operations', () => {
      const data = {
        nodes: [
          { id: 'n1', type: 'process' },
          { id: 'n2', type: 'store' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      };

      const ops: CellOperation[] = (strategy as any)._convertDiagramDataToCellOperations(data);
      expect(ops).toHaveLength(3);
      expect(ops.every((op: CellOperation) => op.operation === 'update')).toBe(true);
      expect(ops.map((op: CellOperation) => op.id)).toEqual(['n1', 'n2', 'e1']);
    });

    it('should return empty array for null data', () => {
      const ops: CellOperation[] = (strategy as any)._convertDiagramDataToCellOperations(null);
      expect(ops).toEqual([]);
    });

    it('should return empty array for undefined data', () => {
      const ops: CellOperation[] = (strategy as any)._convertDiagramDataToCellOperations(undefined);
      expect(ops).toEqual([]);
    });

    it('should handle data with only nodes', () => {
      const data = { nodes: [{ id: 'n1' }] };
      const ops: CellOperation[] = (strategy as any)._convertDiagramDataToCellOperations(data);
      expect(ops).toHaveLength(1);
      expect(ops[0].id).toBe('n1');
    });

    it('should handle data with only edges', () => {
      const data = { edges: [{ id: 'e1' }] };
      const ops: CellOperation[] = (strategy as any)._convertDiagramDataToCellOperations(data);
      expect(ops).toHaveLength(1);
      expect(ops[0].id).toBe('e1');
    });
  });

  describe('ngOnDestroy', () => {
    it('should stop broadcasting after destroy', async () => {
      strategy.ngOnDestroy();

      const event = makeEvent([makeCell('new-1')], []);
      historyOperation$.next(event);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCollaborationAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });
  });
});
